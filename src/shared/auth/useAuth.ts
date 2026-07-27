import { create } from 'zustand';
import { deferred, type Deferred } from '@/shared/lib/deferred';
import { describeError, isUserCancel, type TelegramErrorInfo } from '@/shared/telegram/errors';
import {
  createClient,
  destroyClient,
  exportSession,
  fetchMe,
  getClient,
  logOut,
  type MeInfo,
} from '@/shared/telegram/client';
import type { ApiCredentials } from '@/shared/telegram/credentials';
import { clearStickers } from '@/features/dialogs/lib/stickerCache';
import {
  clearStoredSession,
  loadStoredSession,
  storeSession,
} from '@/shared/telegram/session';

/**
 * 인증 단계.
 *
 * - `idle`      : 아직 시작 안 함. api_id 입력 화면.
 * - `method`    : 로그인 수단(문자/QR) 고르기. 첫 화면 다음, **연결을 맺기 전**이다.
 * - `connecting`: MTProto 연결 + 인증키 교환 중.
 * - `phone`     : 전화번호 입력 대기.
 * - `code`      : 텔레그램이 보낸 로그인 코드 입력 대기.
 * - `qr`        : QR 코드를 띄우고 폰에서 스캔·승인하기를 대기.
 * - `password`  : 2단계 인증 비밀번호 입력 대기.
 * - `authorized`: 로그인 완료.
 */
export type AuthStep =
  | 'idle'
  | 'method'
  | 'connecting'
  | 'phone'
  | 'code'
  | 'qr'
  | 'password'
  | 'authorized';

/** 로그인 수단. 전화번호+코드냐, QR 스캔이냐. */
export type AuthMethod = 'phone' | 'qr';

interface AuthState {
  step: AuthStep;
  /** 폼 제출 후 GramJS 응답을 기다리는 중. 버튼 스피너용. */
  busy: boolean;
  /** 저장된 세션 복원을 시도해 봤는지. 이게 false 인 동안은 화면을 그리면 안 된다. */
  booted: boolean;
  error: TelegramErrorInfo | null;
  /**
   * 요청 제한이 풀리는 시각(epoch ms). 걸린 적이 없으면 undefined.
   *
   * **`error` 와 따로 둔다.** 오류 문구는 화면을 옮길 때마다 지워진다 — `submitPhone`,
   * `restart`, `cancel` 이 전부 `error: null` 로 되돌린다. 제한을 거기서 끌어내면 취소 한
   * 번으로 잠금이 풀려서, 텔레그램은 여전히 막고 있는데 버튼만 다시 눌리는 상태가 된다.
   *
   * 제한은 텔레그램이 **전화번호에** 건 것이라 우리 화면 사정과 무관하다. 그래서 지우지
   * 않고 시각이 지나기를 기다린다. 새로고침하면 사라지는데, 그건 감수한다 — 이 앱은
   * 남기지 않는 것이 신뢰 근거라 이것 하나 때문에 저장소를 열지 않는다.
   */
  floodUntil?: number;
  /**
   * "이 탭에서 로그인 유지". 전화번호 화면에서 켜고 끈다.
   *
   * **폼이 아니라 스토어에 둔다.** `restart()`("다른 번호로")는 GramJS 를 전화번호 단계로
   * 되감으면서 폼을 통째로 다시 그린다. 체크박스를 폼 안에 두면 그때 사용자가 껐던 선택이
   * 조용히 켜진 상태로 되돌아온다 — 공용 PC 라서 껐던 사람에게는 최악의 방향이다.
   *
   * 실제로 읽히는 건 인증이 다 끝난 뒤 `start()` 의 마지막 한 줄이다.
   */
  remember: boolean;
  me: MeInfo | null;
  /** 지금 진행 중인 로그인 수단. `start` 가 시작할 때 기록한다(문자/QR 은 `method` 화면에서 고른다). */
  method: AuthMethod;
  /**
   * QR 화면에 그릴 딥링크(`tg://login?token=...`). `qr` 단계에서만 값이 있다.
   *
   * 토큰은 ~30초마다 갱신되므로 GramJS 의 `qrCode` 콜백이 불릴 때마다 새 값으로 덮는다.
   */
  qrUrl?: string;
  /** 코드가 텔레그램 앱으로 갔는지(true) SMS 로 갔는지(false). 안내 문구가 달라진다. */
  codeViaApp: boolean;
  /** 2단계 인증 비밀번호 힌트. 사용자가 설정해 뒀다면 텔레그램이 내려준다. */
  passwordHint?: string;
  /**
   * 저장된 세션을 이어가지 못한 이유. 로그인 화면에서 모달로 한 번 알려준다.
   * - `expired` : 유휴 시간이 지나 우리가 지웠다.
   * - `invalid` : 값은 살아 있었지만 텔레그램이 더는 인정하지 않았다(다른 기기에서 종료 등).
   */
  notice: 'expired' | 'invalid' | null;

  /** 앱 시작 시 sessionStorage 에 남은 세션으로 로그인 상태를 되살린다. */
  bootstrap: () => Promise<void>;
  dismissNotice: () => void;
  setRemember: (value: boolean) => void;
  /**
   * 자격증명을 받아 **수단 고르기(`method`) 화면으로** 넘어간다. 아직 연결은 안 맺는다 —
   * 문자/QR 을 고른 뒤에야 `start` 가 연결을 시작한다. 첫 화면(CredentialsForm) 다음 단계다.
   */
  stageCredentials: (credentials: ApiCredentials) => void;
  /** `method` 화면에서 문자/QR 을 고르면 그 수단으로 연결을 시작한다. */
  chooseMethod: (method: AuthMethod) => void;
  start: (credentials: ApiCredentials, method?: AuthMethod) => Promise<void>;
  submitPhone: (phoneNumber: string) => void;
  submitCode: (code: string) => void;
  submitPassword: (password: string) => void;
  /**
   * 진행 중인 인증을 접고 **수단 고르기(`method`) 화면으로 되돌아간다.** phone/qr 화면의
   * 뒤로가기가 쓴다 — 다른 수단으로 바꾸려는 사람이 첫 화면까지 안 가고 한 칸만 물러난다.
   */
  backToMethod: () => void;
  /** 코드 입력 화면에서 "다른 번호로" — GramJS 가 전화번호 단계로 되감는다. */
  restart: () => void;
  /** 전부 취소하고 연결을 끊는다. 텔레그램 쪽 세션은 남는다. */
  cancel: () => Promise<void>;
  /** 텔레그램 계정에서 이 세션을 지우고 초기화한다. */
  signOut: () => Promise<void>;
}

/**
 * GramJS 콜백이 기다리고 있는 deferred 들.
 *
 * 스토어 상태에 넣지 않는 이유: 이건 렌더링에 쓰이는 값이 아니라 **한 번 쓰고 버리는 제어
 * 장치**다. 상태에 넣으면 resolve 할 때마다 불필요한 리렌더가 돌고, React 18 의 배칭 때문에
 * "이미 resolve 된 deferred 를 또 붙잡는" 경합이 생기기 쉽다.
 */
const pending: {
  phone?: Deferred<string>;
  code?: Deferred<string>;
  password?: Deferred<string>;
  /**
   * QR 단계에서 GramJS `qrCode` 콜백이 돌려준 promise. **평소엔 resolve 되지 않는다** —
   * GramJS 는 이 promise 와 30초 sleep 을 race 시켜 토큰을 갱신하므로, 우리가 붙잡고 있다가
   * reject 하면 QR 대기 루프를 그 자리에서 끊을 수 있다(취소·방식 전환에 쓴다).
   */
  qr?: Deferred<void>;
} = {};

/** 진행 중인 인증을 끊을 때 GramJS 쪽 while 루프를 빠져나오게 하는 신호. */
const CANCEL = Object.assign(new Error('AUTH_USER_CANCEL'), {
  errorMessage: 'AUTH_USER_CANCEL',
});

/**
 * `start()` 가 마지막에 세션을 저장할 때, 그리고 방식 전환 시 재시작할 때 쓰려고 들고 있는
 * 자격증명. 렌더링에 안 쓰이는 제어 값이라 스토어가 아니라 모듈에 둔다(`pending` 과 같은 이유).
 */
let activeCredentials: ApiCredentials | null = null;

/**
 * 뒤로가기(`backToMethod`)가 걸려 있는지. 진행 중 인증을 취소로 끊으면 `start()` 의 catch 가
 * 이 값을 보고 idle 대신 **수단 고르기 화면(`method`)** 으로 돌려보낸다. 자격증명은
 * `activeCredentials` 에 그대로 남아 있어 거기서 다른 수단을 바로 다시 고를 수 있다.
 */
let backToMethodPending = false;

/**
 * 바이트열을 URL-safe base64(패딩 없음)로. QR 딥링크 `tg://login?token=` 뒤에 붙는 형식이다.
 *
 * `Buffer.toString('base64')` 에 기대지 않고 직접 도는 이유: GramJS 가 주는 token 이 Buffer 든
 * Uint8Array 든 똑같이 동작하게 하려는 것이다.
 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 오류를 화면용으로 풀면서, 요청 제한이면 풀리는 시각도 함께 남긴다.
 *
 * 제한은 `error` 와 수명이 다르다(위 `floodUntil` 주석 참고). 한 자리에서 같이 만들어야
 * 오류를 세우는 경로가 늘어도 잠금이 빠지지 않는다.
 */
function describeWithFlood(err: unknown): Pick<AuthState, 'error' | 'floodUntil'> {
  const error = describeError(err);
  return error.waitUntil ? { error, floodUntil: error.waitUntil } : { error };
}

/**
 * 제한이 아직 안 풀렸으면 **지금 시각 기준으로 다시 계산한** 오류를, 풀렸으면 null 을 준다.
 *
 * 제출을 여기서 삼키는 이유: FLOOD_WAIT 은 **누를수록 대기가 늘어나는** 오류다. 코드가 안
 * 오면 사람은 버튼을 다시 누르고, 그 한 번이 그대로 제한을 키운다. 화면이 이미 버튼을
 * 잠그지만(`SignIn` 의 `blockedLabel` 참고) 엔터 키 하나, 우리가 놓친 경로 하나가 곧바로
 * 요청 한 번이 되므로 요청을 실제로 만드는 자리에서도 막는다.
 *
 * 삼킬 때 오류 문구를 **다시 세우는 것까지가 이 함수의 일이다.** 아무 일도 안 일어나면
 * 사용자는 앱이 멈춘 줄 안다. 남은 초를 다시 계산하는 것도 같은 이유다 — 처음 받은 값을
 * 그대로 쓰면 10분을 기다린 뒤에도 화면은 여전히 처음 그 시간을 말한다.
 */
function floodBlock(floodUntil: number | undefined): TelegramErrorInfo | null {
  if (floodUntil === undefined || Date.now() >= floodUntil) return null;
  return {
    code: 'FLOOD_WAIT',
    waitSeconds: Math.ceil((floodUntil - Date.now()) / 1000),
    waitUntil: floodUntil,
    raw: 'FLOOD_WAIT',
  };
}

function rejectAllPending(reason: unknown) {
  for (const key of ['phone', 'code', 'password', 'qr'] as const) {
    pending[key]?.reject(reason);
    pending[key] = undefined;
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  step: 'idle',
  busy: false,
  booted: false,
  error: null,
  remember: true,
  me: null,
  method: 'phone',
  qrUrl: undefined,
  codeViaApp: true,
  passwordHint: undefined,
  notice: null,

  bootstrap: async () => {
    const result = loadStoredSession();

    // 애초에 저장한 적이 없다 — 그냥 처음 온 사람이다. 알릴 것이 없다.
    if (result.status === 'none') {
      set({ booted: true });
      return;
    }

    if (result.status === 'expired') {
      set({ booted: true, notice: 'expired' });
      return;
    }

    const { stored } = result;
    set({ step: 'connecting' });
    try {
      await createClient({ apiId: stored.apiId, apiHash: stored.apiHash }, stored.session);
      /**
       * 저장된 문자열이 살아 있어도 그 사이 사용자가 다른 기기에서 세션을 종료했을 수 있다.
       * 실제로 유효한지 텔레그램에 물어보고 나서야 로그인 상태로 친다.
       */
      if (await getClient().checkAuthorization()) {
        set({ step: 'authorized', booted: true, me: await fetchMe() });
        return;
      }
    } catch {
      // 재연결 실패도 결국 "이어갈 수 없음"이다. 같은 안내로 묶는다.
    }
    clearStoredSession();
    await destroyClient();
    set({ step: 'idle', booted: true, notice: 'invalid' });
  },

  dismissNotice: () => set({ notice: null }),

  setRemember: (value) => set({ remember: value }),

  start: async (credentials, method = 'phone') => {
    activeCredentials = credentials;
    set({ step: 'connecting', busy: true, error: null, me: null, method, qrUrl: undefined });

    try {
      const client = await createClient(credentials);

      /**
       * 2단계 인증 비밀번호 콜백. 전화번호 로그인과 QR 로그인이 **똑같이** 쓴다 — QR 로
       * 승인하더라도 계정에 클라우드 비밀번호가 걸려 있으면 GramJS 가 이 콜백을 부른다.
       */
      const password = (hint?: string) => {
        const d = deferred<string>();
        pending.password = d;
        set({ step: 'password', busy: false, passwordHint: hint });
        return d.promise;
      };

      /**
       * `false` 를 돌려주면 GramJS 가 같은 단계를 다시 묻는다. 그래서 코드 오타 같은 건
       * 에러 문구만 띄우고 그 자리에서 재입력을 받는다. 사용자가 직접 취소한 경우에만
       * `true` 로 루프를 끊는다.
       */
      const onError = async (err: Error) => {
        if (isUserCancel(err)) return true;
        set({ ...describeWithFlood(err), busy: false });
        return false;
      };

      if (method === 'qr') {
        /**
         * QR 로그인. `signInUserWithQrCode` 는 `auth.exportLoginToken` 을 폴링하며 ~30초마다
         * `qrCode` 콜백을 다시 부른다. 콜백이 돌려준 promise 를 우리가 붙잡고 있다가
         * (`pending.qr`) 취소·방식 전환 때 reject 하면 대기 루프가 곧바로 풀린다.
         */
        await client.signInUserWithQrCode(
          { apiId: credentials.apiId, apiHash: credentials.apiHash },
          {
            qrCode: async ({ token }) => {
              const url = `tg://login?token=${toBase64Url(token)}`;
              const d = deferred<void>();
              pending.qr = d;
              set({ step: 'qr', busy: false, qrUrl: url });
              return d.promise;
            },
            password,
            onError,
          },
        );
      } else {
        /**
         * `phoneNumber` 를 **함수로** 넘기는 게 중요하다.
         *
         * GramJS 의 signInUser 는 `typeof phoneNumber !== 'function'` 이면 첫 에러에서 그대로
         * throw 하고 끝난다. 함수로 주면 onError 를 거쳐 다시 물어보는 루프가 돌아서,
         * "번호를 잘못 눌렀다 → 다시 입력" 이 화면 이동 없이 처리된다.
         */
        await client.start({
          phoneNumber: () => {
            const d = deferred<string>();
            pending.phone = d;
            set({ step: 'phone', busy: false });
            return d.promise;
          },
          phoneCode: (isCodeViaApp) => {
            const d = deferred<string>();
            pending.code = d;
            set({ step: 'code', busy: false, codeViaApp: isCodeViaApp ?? true });
            return d.promise;
          },
          password,
          onError,
        });
      }

      /*
        QR 성공 시 `pending.qr` 는 끝내 resolve 되지 않은 채 남는다(로그인은 GramJS 의
        UpdateLoginToken 으로 끝난다). 여기서 비워 두지 않으면 이후 rejectAllPending 이
        아무도 안 기다리는 promise 를 reject 해 unhandledrejection 이 난다.
      */
      pending.qr = undefined;

      /*
        체크박스는 전화번호 화면에 있고, 그 값은 여기까지 와서야 읽힌다. 인증 도중 언제
        바꿨든 마지막 값이 반영되도록 지금 시점의 상태를 본다.
      */
      if (get().remember) {
        const saved = exportSession();
        if (saved) storeSession({ ...credentials, session: saved });
      }

      set({ step: 'authorized', busy: false, error: null, qrUrl: undefined, me: await fetchMe() });
    } catch (err) {
      rejectAllPending(CANCEL);

      /*
        뒤로가기(`backToMethod`)가 걸어 둔 취소라면 idle 로 떨어뜨리지 않고 **수단 고르기
        화면으로** 돌려보낸다. 자격증명(`activeCredentials`)은 그대로 남아 있어 거기서 다른
        수단을 바로 다시 고를 수 있다. 다음 `start` 의 createClient 가 재사용 전에 정리하지만,
        여기서는 화면이 곧장 method 로 바뀌므로 끊긴 연결을 명시적으로 닫아 둔다.
      */
      if (backToMethodPending) {
        backToMethodPending = false;
        await destroyClient();
        set({ step: 'method', busy: false, error: null, qrUrl: undefined });
        return;
      }

      clearStoredSession();
      await destroyClient();
      set({
        step: 'idle',
        busy: false,
        qrUrl: undefined,
        error: isUserCancel(err) ? null : describeError(err),
      });
    }
  },

  submitPhone: (phoneNumber) => {
    const blocked = floodBlock(get().floodUntil);
    if (blocked) return set({ error: blocked, busy: false });

    set({ busy: true, error: null });
    pending.phone?.resolve(phoneNumber);
    pending.phone = undefined;
  },

  submitCode: (code) => {
    const blocked = floodBlock(get().floodUntil);
    if (blocked) return set({ error: blocked, busy: false });

    set({ busy: true, error: null });
    pending.code?.resolve(code);
    pending.code = undefined;
  },

  submitPassword: (password) => {
    const blocked = floodBlock(get().floodUntil);
    if (blocked) return set({ error: blocked, busy: false });

    set({ busy: true, error: null });
    pending.password?.resolve(password);
    pending.password = undefined;
  },

  stageCredentials: (credentials) => {
    activeCredentials = credentials;
    // 아직 연결하지 않는다. 문자/QR 을 고르는 화면만 띄운다.
    set({ step: 'method', busy: false, error: null, me: null });
  },

  chooseMethod: (method) => {
    if (!activeCredentials) return;
    void get().start(activeCredentials, method);
  },

  backToMethod: () => {
    /**
     * 진행 중 인증을 취소로 끊고 수단 고르기 화면으로 돌아간다. `start()` 의 catch 가
     * `backToMethodPending` 을 보고 idle 대신 `method` 로 보낸다.
     *
     * QR 대기 루프는 `pending.qr` 을 reject 해야 그 자리에서 풀린다 — 안 그러면 GramJS 의
     * 30초 sleep 이 끝날 때까지 안 끊긴다. 전화번호 흐름은 `CANCEL` 이 onError 를 통해 루프를
     * 끝낸다(그쪽은 `pending.qr` 이 비어 있어 무해하다). 그래서 둘 다 `rejectAllPending` 로 끊는다.
     */
    if (!activeCredentials) return;
    backToMethodPending = true;
    set({ busy: true, error: null });
    rejectAllPending(CANCEL);
  },

  restart: () => {
    /**
     * GramJS 는 phoneCode 콜백이 `RESTART_AUTH` 로 reject 되면 signInUser 를 처음부터
     * 다시 돈다. 우리가 직접 상태를 되돌리는 것보다 이쪽이 안전하다 — 라이브러리 내부의
     * phoneCodeHash 같은 값도 같이 버려지기 때문이다.
     */
    const d = pending.code;
    pending.code = undefined;
    set({ error: null, busy: false });
    d?.reject(Object.assign(new Error('RESTART_AUTH'), { errorMessage: 'RESTART_AUTH' }));
  },

  cancel: async () => {
    // 예약된 뒤로가기가 남아 있으면 지운다. 안 그러면 start 의 catch 가 method 로 되돌린다.
    backToMethodPending = false;
    activeCredentials = null;
    rejectAllPending(CANCEL);
    clearStoredSession();
    await destroyClient();
    set({
      step: 'idle',
      busy: false,
      error: null,
      me: null,
      method: 'phone',
      qrUrl: undefined,
      passwordHint: undefined,
    });
  },

  signOut: async () => {
    backToMethodPending = false;
    activeCredentials = null;
    rejectAllPending(CANCEL);
    // 저장본을 먼저 지운다. LogOut 요청이 실패하더라도 이 브라우저에는 아무것도 안 남게.
    clearStoredSession();
    // 스티커 그림 캐시도 함께 비운다. "무엇이 남았나"를 단순하게 유지한다.
    void clearStickers();
    set({ busy: true });
    try {
      await logOut();
    } catch {
      // 세션이 이미 죽었으면 LogOut 도 실패한다. 어차피 목적은 로컬 초기화다.
      await destroyClient();
    }
    set({
      step: 'idle',
      busy: false,
      error: null,
      me: null,
      method: 'phone',
      qrUrl: undefined,
      passwordHint: undefined,
    });
  },
}));

/** 로그인된 클라이언트가 필요할 때 쓰는 접근자. 인증 전에 부르면 던진다. */
export function requireClient() {
  if (useAuth.getState().step !== 'authorized') {
    throw new Error('로그인이 필요합니다.');
  }
  return getClient();
}
