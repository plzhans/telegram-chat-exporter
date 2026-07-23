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
  /** FLOOD_WAIT 계열일 때 텔레그램이 알려준 대기 초. 받은 그 순간의 값이다. */
  waitSeconds?: number;
  /**
   * 제한이 풀리는 시각(epoch ms).
   *
   * **초가 아니라 시각으로 들고 있는 것이 요점이다.** 초만 담아 두면 오류가 뜬 순간의
   * 값에서 멈춰, 30분을 기다린 뒤에도 화면은 여전히 "24시간 후" 라고 말한다. 끝나는 시각을
   * 담아 두면 화면이 언제 다시 그려지든 남은 시간을 스스로 계산한다.
   *
   * 내보내기 진행 정보(`ExportProgress.floodWaitUntil`)와 같은 규칙이다.
   */
  waitUntil?: number;
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

/**
 * 요청 제한 오류에서 기다려야 하는 초를 읽는다. 그 오류가 아니면 undefined.
 *
 * **`seconds` 를 먼저 본다.** GramJS 의 `FloodWaitError` 는 `FloodError` 를 상속하는데, 그
 * 부모 생성자가 `errorMessage` 를 통째로 `"FLOOD"` 로 덮어쓴다. 즉 텔레그램이
 * `FLOOD_WAIT_86400` 을 보내와도 객체에 남는 값은 이렇게 갈린다.
 *
 * ```
 * errorMessage : "FLOOD"                                    ← 초가 사라진다
 * message      : "A wait of 86400 seconds is required (...)"
 * seconds      : 86400                                      ← 여기에만 온전히 남는다
 * ```
 *
 * 그래서 문자열만 뒤지면 남은 시간을 못 찾고 알 수 없는 오류로 떨어진다. 실제로 로그인
 * 화면에 "알 수 없는 오류가 발생했습니다: FLOOD" 가 떴다.
 *
 * 문자열 쪽도 그대로 둔다. GramJS 를 거치지 않고 원문이 그대로 올라오는 경로가 있고,
 * `FLOOD_PREMIUM_WAIT_` 같은 변종도 모양이 같아 한 번에 걸린다.
 */
export function floodWaitSeconds(err: unknown): number | undefined {
  const seconds = (err as { seconds?: unknown } | null)?.seconds;
  if (typeof seconds === 'number' && Number.isFinite(seconds)) return seconds;

  const matched = /FLOOD(?:_\w+?)?_WAIT_(\d+)/.exec(messageOf(err));
  return matched ? Number(matched[1]) : undefined;
}

export function describeError(err: unknown): TelegramErrorInfo {
  const raw = messageOf(err);

  /*
    공개 도구는 요청 제한을 반드시 밟게 되므로(같은 계정으로 반복 로그인·대량 조회) 남은
    시간을 사용자에게 보여줘야 한다. "다시 시도해 보세요" 만으로는 언제 다시 오라는 건지
    알 수 없어서, 사용자가 곧바로 또 눌러 제한을 더 키운다.
  */
  const waitSeconds = floodWaitSeconds(err);
  if (waitSeconds !== undefined) {
    return { code: 'FLOOD_WAIT', waitSeconds, waitUntil: Date.now() + waitSeconds * 1000, raw };
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
