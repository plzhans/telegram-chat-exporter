import type { ApiCredentials } from '@/shared/telegram/credentials';

/**
 * 방식 고르기(`/run/`)에서 텔레그램 문서(`/run/session/`)로 자격증명을 넘기는 **1회성 핸드오프**.
 *
 * 두 문서는 CSP가 갈린다(방식=구글 open, 텔레그램=텔레그램 전용). 그래서 SPA 한 문서로 못 잇고
 * **진짜 페이지 이동**으로 넘어가는데, 그때 고른 api_id/api_hash 를 전달할 통로가 필요하다.
 *
 * **왜 sessionStorage인가**
 * - 같은 탭 안의 이동에서는 유지되고(탭 단위), URL·히스토리·referrer에 안 남으며, 탭을 닫으면
 *   사라진다 — 이 앱의 "아무것도 안 남긴다" 원칙과 맞는다. query param은 주소창·히스토리에
 *   남고, POST는 서버가 없어 목적지가 못 읽는다.
 * - **connect-src와 무관**하다(로컬 접근이라 네트워크를 안 탄다). 그래서 텔레그램 문서를
 *   텔레그램 전용 CSP로 조여도 핸드오프엔 영향이 없다 — 바로 그게 목적이다.
 *
 * ## 난독화는 암호화가 아니다
 *
 * 아래 `enc`/`dec`는 XOR+base64일 뿐이고, **같은 출처 JS가 이 코드로 언제든 되돌린다.** 목적은
 * 딱 "devtools로 흘깃 봐도 apiHash로 바로 안 읽히게" 하는 것뿐이다. 진짜 비밀 유지가 아니다 —
 * 애초에 공용 키는 번들에 평문으로 박혀 추출 가능하고, api_id/api_hash는 계정 비밀도 아니다
 * (`credentials.ts` 주석). 그래서 무겁게(AES 등) 가지 않는다.
 */

/** 밋밋한 키 이름. "여기 자격증명 있음"을 대놓고 알리지 않는다. */
const KEY = 'tce.hs';

/** 고정 난독 키. **비밀이 아니다**(번들에 있다). 흘깃 방지용일 뿐. */
const K = 'tce';

/** XOR은 자기 역함수라 enc/dec가 대칭이다. api 값은 숫자·hex(ascii)라 latin1 범위 안이다. */
const scramble = (s: string): string =>
  Array.from(s, (c, i) => String.fromCharCode(c.charCodeAt(0) ^ K.charCodeAt(i % K.length))).join('');

const isCredentials = (v: unknown): v is ApiCredentials =>
  typeof v === 'object' &&
  v !== null &&
  Number.isInteger((v as ApiCredentials).apiId) &&
  (v as ApiCredentials).apiId > 0 &&
  typeof (v as ApiCredentials).apiHash === 'string' &&
  /^[0-9a-f]{32}$/i.test((v as ApiCredentials).apiHash);

export function writeHandoff(creds: ApiCredentials): void {
  try {
    sessionStorage.setItem(KEY, btoa(scramble(JSON.stringify(creds))));
  } catch {
    // 사생활 보호 모드 등에서 막혀 있을 수 있다. 그때는 텔레그램 문서가 핸드오프를 못 찾아
    // 방식 화면으로 되돌린다 — 치명적이지 않다.
  }
}

export function readHandoff(): ApiCredentials | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(scramble(atob(raw)));
    return isCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearHandoff(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* 위와 같다. */
  }
}
