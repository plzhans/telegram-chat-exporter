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
 * - `connecting`: MTProto 연결 + 인증키 교환 중.
 * - `phone`     : 전화번호 입력 대기.
 * - `code`      : 텔레그램이 보낸 로그인 코드 입력 대기.
 * - `password`  : 2단계 인증 비밀번호 입력 대기.
 * - `authorized`: 로그인 완료.
 */
export type AuthStep = 'idle' | 'connecting' | 'phone' | 'code' | 'password' | 'authorized';

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
  me: MeInfo | null;
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
  start: (credentials: ApiCredentials, remember: boolean) => Promise<void>;
  submitPhone: (phoneNumber: string) => void;
  submitCode: (code: string) => void;
  submitPassword: (password: string) => void;
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
} = {};

/** 진행 중인 인증을 끊을 때 GramJS 쪽 while 루프를 빠져나오게 하는 신호. */
const CANCEL = Object.assign(new Error('AUTH_USER_CANCEL'), {
  errorMessage: 'AUTH_USER_CANCEL',
});

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

function rejectAllPending(reason: unknown) {
  for (const key of ['phone', 'code', 'password'] as const) {
    pending[key]?.reject(reason);
    pending[key] = undefined;
  }
}

export const useAuth = create<AuthState>((set) => ({
  step: 'idle',
  busy: false,
  booted: false,
  error: null,
  me: null,
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

  start: async (credentials, remember) => {
    set({ step: 'connecting', busy: true, error: null, me: null });

    try {
      const client = await createClient(credentials);

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
        password: (hint) => {
          const d = deferred<string>();
          pending.password = d;
          set({ step: 'password', busy: false, passwordHint: hint });
          return d.promise;
        },
        /**
         * `false` 를 돌려주면 GramJS 가 같은 단계를 다시 묻는다. 그래서 코드 오타 같은 건
         * 에러 문구만 띄우고 그 자리에서 재입력을 받는다. 사용자가 직접 취소한 경우에만
         * `true` 로 루프를 끊는다.
         */
        onError: async (err) => {
          if (isUserCancel(err)) return true;
          set({ ...describeWithFlood(err), busy: false });
          return false;
        },
      });

      if (remember) {
        const saved = exportSession();
        if (saved) storeSession({ ...credentials, session: saved });
      }

      set({ step: 'authorized', busy: false, error: null, me: await fetchMe() });
    } catch (err) {
      rejectAllPending(CANCEL);
      clearStoredSession();
      await destroyClient();
      set({
        step: 'idle',
        busy: false,
        error: isUserCancel(err) ? null : describeError(err),
      });
    }
  },

  submitPhone: (phoneNumber) => {
    set({ busy: true, error: null });
    pending.phone?.resolve(phoneNumber);
    pending.phone = undefined;
  },

  submitCode: (code) => {
    set({ busy: true, error: null });
    pending.code?.resolve(code);
    pending.code = undefined;
  },

  submitPassword: (password) => {
    set({ busy: true, error: null });
    pending.password?.resolve(password);
    pending.password = undefined;
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
    rejectAllPending(CANCEL);
    clearStoredSession();
    await destroyClient();
    set({ step: 'idle', busy: false, error: null, me: null, passwordHint: undefined });
  },

  signOut: async () => {
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
    set({ step: 'idle', busy: false, error: null, me: null, passwordHint: undefined });
  },
}));

/** 로그인된 클라이언트가 필요할 때 쓰는 접근자. 인증 전에 부르면 던진다. */
export function requireClient() {
  if (useAuth.getState().step !== 'authorized') {
    throw new Error('로그인이 필요합니다.');
  }
  return getClient();
}
