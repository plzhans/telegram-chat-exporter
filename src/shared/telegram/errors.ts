/**
 * 텔레그램 RPC 에러를 화면에 쓸 수 있는 모양으로 정규화한다.
 *
 * GramJS 가 던지는 에러는 종류가 제각각이다 — RPCError 인스턴스일 때도 있고, 그냥 Error 에
 * `errorMessage` 프로퍼티만 달려 올 때도 있다. 화면 코드가 매번 그걸 헤집지 않도록 여기서
 * **코드 문자열 하나**로 좁힌다.
 */
export interface TelegramErrorInfo {
  /** `PHONE_CODE_INVALID` 같은 정규화된 코드. i18n 키(`errors.<code>`)로 그대로 쓴다. */
  code: string;
  /** FLOOD_WAIT 계열일 때 대기해야 하는 초. */
  waitSeconds?: number;
  /** 매핑에 실패했을 때 원문을 그대로 보여주기 위한 백업. */
  raw: string;
}

/** 화면이 별도 문구를 준비해 둔 코드들. 여기 없으면 `errors.UNKNOWN` + 원문으로 떨어진다. */
const KNOWN_CODES = new Set([
  'API_ID_INVALID',
  'API_ID_PUBLISHED_FLOOD',
  'AUTH_RESTART',
  'AUTH_USER_CANCEL',
  'PASSWORD_HASH_INVALID',
  'PHONE_CODE_EXPIRED',
  'PHONE_CODE_INVALID',
  'PHONE_NUMBER_BANNED',
  'PHONE_NUMBER_INVALID',
  'PHONE_NUMBER_UNOCCUPIED',
  'PHONE_PASSWORD_FLOOD',
  'SESSION_PASSWORD_NEEDED',
  'SESSION_REVOKED',
  'UPDATE_APP_TO_LOGIN',
]);

function messageOf(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { errorMessage?: unknown; message?: unknown };
    if (typeof e.errorMessage === 'string') return e.errorMessage;
    if (typeof e.message === 'string') return e.message;
  }
  return String(err);
}

export function describeError(err: unknown): TelegramErrorInfo {
  const raw = messageOf(err);

  /**
   * FLOOD_WAIT 은 `FLOOD_WAIT_86400` 처럼 초가 코드에 붙어서 온다. 공개 도구는 이걸 반드시
   * 밟게 되므로(같은 계정으로 반복 로그인·대량 조회) 남은 시간을 사용자에게 보여줘야 한다.
   * FLOOD_PREMIUM_WAIT_ / FLOOD_TEST_PHONE_WAIT_ 같은 변종도 같은 모양이다.
   */
  const flood = /FLOOD(?:_\w+?)?_WAIT_(\d+)/.exec(raw);
  if (flood) {
    return { code: 'FLOOD_WAIT', waitSeconds: Number(flood[1]), raw };
  }

  const code = KNOWN_CODES.has(raw) ? raw : undefined;
  if (code) return { code, raw };

  // 일부 에러는 "PHONE_CODE_INVALID (caused by auth.SignIn)" 처럼 뒤에 설명이 붙는다.
  const head = raw.split(/[\s(]/, 1)[0];
  if (KNOWN_CODES.has(head)) return { code: head, raw };

  return { code: 'UNKNOWN', raw };
}

/** 사용자가 직접 중단한 경우. 화면에 에러로 띄우면 안 된다. */
export function isUserCancel(err: unknown): boolean {
  return messageOf(err).includes('AUTH_USER_CANCEL');
}
