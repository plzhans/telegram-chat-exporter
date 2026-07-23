/**
 * 한글·한자·가나가 섞여 있는지. 이 글자들을 쓰는 이름은 성을 앞에 놓고 띄어쓰지 않는다.
 *
 * - `가-힣` 한글 음절, `ᄀ-ᇿ`·`㄰-㆏` 자모
 * - `一-鿿` 한자
 * - `぀-ヿ` 히라가나·가타카나
 */
const FAMILY_NAME_FIRST = /[가-힣ᄀ-ᇿ㄰-㆏一-鿿぀-ヿ]/;

/**
 * 텔레그램의 성/이름 필드를 사람이 읽는 순서로 합친다.
 *
 * 텔레그램은 `firstName`(이름)과 `lastName`(성)을 따로 저장할 뿐 **어떤 순서로 표기해야
 * 하는지는 알려주지 않는다.** 그래서 그냥 이어 붙이면 "손원철"이 `원철 손` 으로 뒤집힌다.
 *
 * 이름에 쓰인 문자로 판단한다. UI 언어로 판단하면 안 된다 — 한국어로 쓰는 사람에게도
 * 외국인 연락처가 있고, 그 사람 이름까지 뒤집어 버린다.
 */
export function formatPersonName(firstName?: string, lastName?: string): string {
  const first = firstName?.trim() ?? '';
  const last = lastName?.trim() ?? '';
  if (!first) return last;
  if (!last) return first;
  if (FAMILY_NAME_FIRST.test(first) || FAMILY_NAME_FIRST.test(last)) return `${last}${first}`;
  return `${first} ${last}`;
}
