import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import examples from 'libphonenumber-js/examples.mobile.json';

export type { CountryCode };

/** 고를 수 있는 나라 전부. libphonenumber 메타데이터가 아는 목록 그대로다. */
export const COUNTRIES: CountryCode[] = getCountries();

export function callingCodeOf(country: CountryCode): string {
  return getCountryCallingCode(country);
}

/**
 * 나라 이름은 `Intl` 이 사용자 언어로 준다. 245개를 번역 파일에 적을 일이 없다.
 */
export function countryName(country: CountryCode, uiLang: string): string {
  try {
    return new Intl.DisplayNames([uiLang], { type: 'region' }).of(country) ?? country;
  } catch {
    return country;
  }
}

/**
 * 국기 그림문자. `KR` → 🇰🇷.
 *
 * 두 글자를 지역 표시 기호로 옮기면 브라우저가 국기로 합쳐 그린다. 파일을 받아올 일이
 * 없어서 CSP 를 건드리지 않는다. 국기 글꼴이 없는 환경(주로 윈도우)에서는 `KR` 두 글자로
 * 보이는데, 그것도 나라를 알아보는 데는 쓸모가 있어서 그대로 둔다.
 */
export function countryFlag(country: string): string {
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/** 화면 언어에서 기본 국가를 유추한다. `ko-kr` → `KR`. 못 읽어내면 없는 채로 둔다. */
export function countryFromLanguage(lang: string): CountryCode | undefined {
  const region = lang.split('-')[1]?.toUpperCase();
  return region && (COUNTRIES as string[]).includes(region) ? (region as CountryCode) : undefined;
}

export interface NormalizedPhone {
  /** 텔레그램으로 보낼 값(E.164). 비어 있으면 보낼 수 없다. */
  value: string;
  /**
   * 그 나라 번호 형식에 맞는가.
   *
   * **틀렸다고 막지 않는다.** 번호 대역은 계속 새로 생기는데 메타데이터는 뒤늦게 따라온다.
   * 막아 버리면 방금 개통한 번호를 쓰는 사람은 이 도구를 아예 못 쓴다. 알려만 주고
   * 보낼지는 사용자가 정한다.
   */
  valid: boolean;
  /** `+` 로 시작해서 나라를 알아낸 경우. 선택 상자를 여기에 맞춰 준다. */
  detectedCountry?: CountryCode;
  /** 사람이 보기 좋은 형태. 화면에 "이 번호로 보냅니다" 로 되짚어 준다. */
  formatted: string;
}

/**
 * 사람이 적는 번호를 텔레그램이 받는 국제 형식으로 바꾼다.
 *
 * `+` 로 시작하면 **적힌 그대로** 읽는다. 선택된 나라를 무시한다 — 사용자가 국가번호를
 * 직접 적었다면 그게 의도다. 목록에 자기 나라가 없거나 형식이 특이한 사람의 탈출구다.
 *
 * `+` 가 없으면 선택된 나라의 번호로 읽는다. 예전에는 나라를 묻지 않고 무조건 한국으로
 * 봤는데, 그러면 미국 번호를 적은 사람에게 존재하지 않는 한국 번호로 코드가 발송된다.
 */
export function normalizePhone(input: string, country?: CountryCode): NormalizedPhone {
  const raw = input.trim();
  if (!raw) return { value: '', valid: false, formatted: '' };

  // `00` 은 국제전화 접두사라 `+` 와 같은 뜻이다. 먼저 바꿔 두고 아래 규칙을 태운다.
  const cleaned = raw.replace(/^00/, '+');
  const explicit = cleaned.startsWith('+');

  const parsed = parsePhoneNumberFromString(cleaned, explicit ? undefined : country);
  if (!parsed) {
    /*
      파싱조차 못 한 경우에도 숫자가 있으면 보낼 값은 만들어 준다. 여기서 빈손으로
      돌려주면 버튼이 잠겨 아무것도 못 하게 된다 - 막지 않는다는 원칙이 여기에도 걸린다.
    */
    const digits = cleaned.replace(/\D/g, '');
    if (!digits) return { value: '', valid: false, formatted: '' };
    const value = explicit
      ? `+${digits}`
      : country
        ? `+${getCountryCallingCode(country)}${digits.replace(/^0+/, '')}`
        : `+${digits}`;
    return { value, valid: false, formatted: value };
  }

  return {
    value: parsed.number,
    valid: parsed.isValid(),
    detectedCountry: explicit ? parsed.country : undefined,
    formatted: parsed.formatInternational(),
  };
}

/**
 * 그 나라 사람이 평소 적는 모양의 예시. 입력 칸 placeholder 로 쓴다.
 *
 * **국가번호를 뺀 국내 표기다.** `+82` 는 왼쪽 선택 버튼에 이미 떠 있어서, 예시에도 넣으면
 * 사용자가 그걸 보고 한 번 더 적는다. 나라마다 자릿수와 묶는 방식이 달라서
 * (`010-2000-0000` · `(201) 555-0123` · `07400 123456`) 한 가지를 박아 두면 나머지 나라
 * 사람들에게는 틀린 안내가 된다.
 *
 * 예시 데이터는 4KB 짜리 파일 하나다.
 */
export function examplePhone(country?: CountryCode): string {
  if (!country) return '';
  try {
    return getExampleNumber(country, examples)?.formatNational() ?? '';
  } catch {
    return '';
  }
}
