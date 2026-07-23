const KOREA_COUNTRY_CODE = '82';

/**
 * `+82` 뒤에 남은 국내용 0 을 뗀다.
 *
 * `+8201085823019` 처럼 국가번호와 국내 표기를 **둘 다** 붙여 적는 실수가 잦다. 사람 눈에는
 * "국가번호도 넣고 내 번호도 그대로 넣었다"라 자연스럽지만, 국제 형식에서 그 0 은 들어가면
 * 안 되는 자리라 텔레그램이 `PHONE_NUMBER_INVALID` 로 거절한다. 무엇이 잘못됐는지 알려주지도
 * 않아서 사용자는 번호를 노려보며 헤맨다.
 *
 * `+82` 에만 적용한다. 다른 나라도 국내 접두사 0 을 쓰는 곳이 많지만, 우리가 확실히 아는
 * 규칙이 아닌 번호를 말없이 고치면 **적지도 않은 번호로 인증코드를 보내게 된다.**
 */
function stripKoreanTrunkZero(e164: string): string {
  const matched = /^\+82(0+)(\d+)$/.exec(e164);
  return matched ? `+${KOREA_COUNTRY_CODE}${matched[2]}` : e164;
}

export interface NormalizedPhone {
  /** 텔레그램으로 보낼 값. */
  value: string;
  /** 우리가 손대서 바뀌었는지. 바뀌었으면 화면에 결과를 보여줘야 한다. */
  converted: boolean;
}

/**
 * 사람이 적는 번호를 텔레그램이 받는 국제 형식으로 바꾼다.
 *
 *     '010-8582-3019'   → '+821085823019'
 *     '01085823019'     → '+821085823019'
 *     '1085823019'      → '+821085823019'
 *     '+821085823019'   → '+821085823019'  (이미 맞는 형식)
 *     '+8201085823019'  → '+821085823019'  (국가번호 + 국내표기 중복)
 *     '008210 8582 3019'→ '+821085823019'  (00 은 국제전화 접두사)
 *     '+14155550123'    → '+14155550123'   (다른 나라는 적은 대로)
 *
 * **기본은 한국(+82)이다.** 이 도구를 쓸 사람이 대부분 한국 번호라, 국가번호를 고르게
 * 하거나 매번 `+82` 를 치게 하는 건 그 자체로 비용이다. `+` 로 시작하면 그건 사용자가
 * 의도해서 적은 것이므로 나라를 바꾸지 않는다.
 */
export function normalizePhone(input: string): NormalizedPhone {
  const raw = input.trim();
  if (!raw) return { value: '', converted: false };

  // 공백·하이픈·괄호·점은 다 지운다. 사람마다 적는 방식이 달라서 그대로 두면 안 된다.
  const cleaned = raw.replace(/[\s\-().]/g, '');

  // `00` 은 국제전화 접두사다. `+` 와 같은 뜻이므로 먼저 바꿔 놓고 아래 규칙을 태운다.
  const withPlus = cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;

  if (withPlus.startsWith('+')) {
    const value = stripKoreanTrunkZero(`+${withPlus.slice(1).replace(/\D/g, '')}`);
    return { value, converted: value !== cleaned };
  }

  const digits = withPlus.replace(/\D/g, '');
  if (!digits) return { value: '', converted: false };

  // 국내 표기의 앞자리 0 을 떼고 국가번호를 붙인다.
  return { value: `+${KOREA_COUNTRY_CODE}${digits.replace(/^0+/, '')}`, converted: true };
}
