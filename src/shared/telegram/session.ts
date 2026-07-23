import type { ApiCredentials } from './credentials';

export interface StoredSession extends ApiCredentials {
  /** GramJS `StringSession.save()` 결과. 이 문자열 자체가 계정 접근 권한이다. */
  session: string;
}

interface StoredPayload extends StoredSession {
  /** 이 시각(ms epoch)이 지나면 버린다. */
  expiresAt: number;
}

const KEY = 'telegram-chat-exporter:session';

/**
 * 마지막으로 이 탭을 쓴 뒤 이만큼 지나면 저장본을 버린다.
 *
 * **절대 만료가 아니라 유휴 만료다.** 탭이 살아 있는 동안 `touchStoredSession()` 이 주기적으로
 * 시각을 밀어주므로, 작업 중에 만료되지는 않는다.
 */
const IDLE_TTL_MS = 60 * 60 * 1000;

/**
 * 세션은 **sessionStorage** 에, 그것도 **유휴 만료를 달아서** 둔다.
 *
 * localStorage 를 안 쓰는 이유는 수명이다. 이 문자열은 인증키 그 자체라, 명시적으로 지울
 * 때까지 남는 저장소에 두면 공용 PC 나 프로필 공유 상황에서 그대로 계정이 넘어간다.
 *
 * sessionStorage 만으로는 두 구멍이 남는다.
 * 1. 크롬·파이어폭스의 **세션 복원**("계속하기", 비정상 종료 후 복구)은 sessionStorage 까지
 *    되살린다. 즉 "탭을 닫으면 사라진다"가 항상 참은 아니다.
 * 2. **탭을 켜둔 채 자리를 비우면** 며칠이고 그대로 남는다. 브라우저는 아무것도 안 해준다.
 *
 * 만료 시각을 같이 저장하면 1번은 "TTL 보다 늦게 복원된 경우"에 한해 막히고, 2번은 제대로
 * 막힌다. 크래시 직후 즉시 복원이나 탭 복제처럼 **시간이 안 흐른 경우는 여전히 못 막는다** —
 * TTL 은 노출 창을 좁힐 뿐 없애지는 못한다. 확실히 지우는 유일한 방법은 로그아웃이다.
 */
/**
 * `none` 과 `expired` 를 구분하는 이유:
 *
 * 둘 다 결과적으로 로그인 화면이지만 사용자에게는 전혀 다른 사건이다. 처음 온 사람에게는
 * 그냥 로그인 화면이고, 자리를 비웠다 돌아온 사람에게는 **"방금까지 로그인돼 있었는데 왜
 * 풀렸지?"** 다. 후자에게 아무 설명 없이 로그인 화면만 띄우면 앱이 고장 난 것처럼 보인다.
 */
export type SessionLoadResult =
  | { status: 'none' }
  | { status: 'expired' }
  | { status: 'ok'; stored: StoredSession };

export function loadStoredSession(): SessionLoadResult {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return { status: 'none' };

    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    if (typeof parsed.session !== 'string' || !parsed.session) return { status: 'none' };
    if (typeof parsed.apiId !== 'number' || typeof parsed.apiHash !== 'string') {
      return { status: 'none' };
    }

    // expiresAt 이 없는 저장본은 이 기능이 생기기 전 것이거나 손댄 것이다. 믿지 않는다.
    if (typeof parsed.expiresAt !== 'number' || Date.now() > parsed.expiresAt) {
      clearStoredSession();
      return { status: 'expired' };
    }

    return {
      status: 'ok',
      stored: { apiId: parsed.apiId, apiHash: parsed.apiHash, session: parsed.session },
    };
  } catch {
    return { status: 'none' };
  }
}

export function storeSession(value: StoredSession): void {
  try {
    const payload: StoredPayload = { ...value, expiresAt: Date.now() + IDLE_TTL_MS };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // 사생활 보호 모드 등에서 막혀 있을 수 있다. 저장 실패는 치명적이지 않다 —
    // 새로고침하면 다시 로그인해야 할 뿐이다.
  }
}

/**
 * 만료 시각만 뒤로 민다.
 *
 * 탭이 살아 있는 동안 주기적으로 불린다. **저장본이 없으면 아무것도 하지 않는다** —
 * "로그인 유지"를 끈 사용자에게 몰래 세션을 심으면 안 되기 때문이다.
 */
export function touchStoredSession(): void {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (typeof parsed.expiresAt !== 'number' || Date.now() > parsed.expiresAt) {
      clearStoredSession();
      return;
    }
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...parsed, expiresAt: Date.now() + IDLE_TTL_MS }),
    );
  } catch {
    /* 위와 같다. */
  }
}

export function clearStoredSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* 위와 같다. */
  }
}

/** 화면 문구에서 "N분 동안 쓰지 않으면" 을 말하기 위해 노출한다. */
export const IDLE_TTL_MINUTES = IDLE_TTL_MS / 60_000;
