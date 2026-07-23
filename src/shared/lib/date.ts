/**
 * 날짜/시각 변환은 **전부 여기를 거친다.**
 *
 * ## 왜 한 곳에 모으는가
 *
 * 텔레그램은 메시지 시각을 **Unix 초** 하나로만 준다. Unix 초는 "1970-01-01T00:00:00Z 부터
 * 몇 초"라는 **절대 시각**이라 그 자체에는 시간대가 없다. 그래서 "API 가 UTC 기준이냐"는
 * 질문의 답은 반만 맞다 — 에포크의 기준점이 UTC 일 뿐, 값에는 시간대가 안 들어 있다.
 *
 * 시간대가 실제로 개입하는 건 **절대 시각을 달력으로 자를 때**다.
 * - "이 메시지는 며칠자인가" → 어느 시간대의 달력으로 보느냐에 따라 답이 달라진다
 * - "7월 11일 0시부터" → 어느 시간대의 0시인가
 *
 * 이 앱은 **브라우저 로컬 시간대 하나로만** 자른다. 사용자가 텔레그램 앱에서 보던 것과
 * 같은 날짜여야 하기 때문이다. 한국 사용자에게 UTC 로 자른 "7월 11일"은 실제로는
 * 7월 11일 09:00 ~ 7월 12일 09:00 이라 전혀 다른 날이 된다.
 *
 * ## 방향별 규칙
 *
 * - **API → 화면**: `dateKeyOf`, `isSameLocalDay`, `formatExportTimestamp` 로 로컬 달력에 맞춘다.
 *   `toISOString()` 은 **쓰지 않는다** — 그건 UTC 라 한국 시간 새벽이 전날로 밀린다.
 * - **화면 → API**: `startOfDayUnix`/`endOfDayUnix` 로 로컬 자정을 Unix 초로 바꿔 보낸다.
 *   로컬 Date 를 만들면 `getTime()` 이 알아서 오프셋을 반영하므로 따로 더하고 뺄 것이 없다
 *   (KST 7/11 00:00 → 7/10T15:00Z 에 해당하는 값이 나온다).
 */

/** `2024-01-31`. 로컬 달력 기준 날짜. */
export type DateKey = string;

function pad(value: number): string {
  return `${value}`.padStart(2, '0');
}

/** Date → 로컬 기준 `yyyy-mm-dd`. */
export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Unix 초 → 로컬 기준 `yyyy-mm-dd`. */
export function dateKeyOf(unixSeconds: number): DateKey {
  return toDateKey(new Date(unixSeconds * 1000));
}

/**
 * 화면에 보여주는 날짜. `2026.07.23`.
 *
 * 내부에서 쓰는 `yyyy-mm-dd` 와 구분한다 — 그쪽은 `<input type="date">` 가 요구하는 형식이자
 * 비교·정렬의 기준이라 바꿀 수 없다. 사람에게 보여줄 때만 점 표기로 옮긴다.
 */
export function formatDisplayDate(unixSeconds: number): string {
  return dateKeyOf(unixSeconds).replace(/-/g, '.');
}

/**
 * `yyyy-mm-dd` → 그 날 **로컬 자정**의 Date.
 *
 * 문자열 파싱(`new Date('2024-01-31T00:00:00')`)에 기대지 않고 숫자로 직접 만든다.
 * 파싱 규칙은 형식이 조금만 어긋나도 UTC 로 해석되는 함정이 있다.
 */
export function startOfDay(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** `yyyy-mm-dd` → 그 날 **로컬 23:59:59.999** 의 Date. 끝 경계를 포함시킬 때 쓴다. */
export function endOfDay(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

/** Date → Unix 초. API 로 보낼 때는 항상 이걸 거친다. */
export function toUnix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function startOfDayUnix(key: DateKey): number {
  return toUnix(startOfDay(key));
}

export function endOfDayUnix(key: DateKey): number {
  return toUnix(endOfDay(key));
}

/** 날짜 키를 며칠 앞뒤로 민다. 월말·윤년·서머타임 경계는 Date 가 알아서 처리한다. */
export function shiftDateKey(key: DateKey, days: number): DateKey {
  const date = startOfDay(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** 오늘(로컬). 달력에서 미래를 막을 때 쓴다. */
export function todayKey(): DateKey {
  return toDateKey(new Date());
}

/** Unix 초 두 개가 같은 로컬 날인지. 메시지 사이에 날짜 구분선을 넣을지 판단한다. */
export function isSameLocalDay(aUnixSeconds: number, bUnixSeconds: number): boolean {
  return dateKeyOf(aUnixSeconds) === dateKeyOf(bUnixSeconds);
}

/**
 * 요일 표기.
 *
 * `Intl` 로 뽑지 않고 고정 배열을 쓴다. 내보낸 파일은 **다른 기기에서 다시 읽히는 기록물**이라
 * 만든 사람의 브라우저 언어에 따라 값이 달라지면 곤란하다. 파싱하는 쪽도 고정이어야 편하다.
 *
 * 영문 세 글자로 통일한 이유는, 이 값이 로그 형식의 일부라 **어느 환경에서 열어도 깨지지
 * 않아야** 하기 때문이다. 한글은 인코딩을 잘못 잡은 도구에서 깨지지만 ASCII 는 안 깨진다.
 */
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * 내보내기 파일에 찍는 시각. `2026-07-11 12:24:07,Sat` (로컬).
 *
 * - 밀리초는 넣지 않는다 — 텔레그램이 초 단위로만 주므로 언제나 `.000` 이다.
 * - **요일을 붙인다.** 기록을 나중에 근거로 쓸 때 "이게 주말이었나"가 날짜만으로는 즉시
 *   안 보인다. 읽는 사람이 달력을 따로 펴야 하는 상황을 없앤다.
 */
export function formatExportTimestamp(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${toDateKey(date)} ${time},${WEEKDAY_LABELS[date.getDay()]}`;
}

/**
 * 파일 이름에 넣는 시각. `260723_143052` (로컬, 24시간제).
 *
 * 구분자를 안 쓰는 이유는 파일 이름이라서다 — `:` 는 여러 OS 에서 쓸 수 없고, 공백은 명령줄
 * 에서 다루기 번거롭다. 날짜와 시각 사이의 `_` 하나만 남긴다.
 *
 * 연도는 **두 자리**다. 이름을 줄이려는 것이고, 사전순 정렬이 곧 시간순이라는 성질은
 * 그대로 남는다(세기가 바뀌기 전까지). 파일 안의 시각(`formatExportTimestamp`)은 기록물이라
 * 네 자리를 유지한다 — 그쪽은 길이보다 모호하지 않은 게 중요하다.
 */
export function formatFileTimestamp(date: Date = new Date()): string {
  const year = `${date.getFullYear() % 100}`.padStart(2, '0');
  const day = `${year}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${day}_${time}`;
}

/** `Asia/Seoul` 같은 IANA 이름. 내보낸 파일이 스스로를 설명할 수 있게 기록한다. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** UTC 대비 분 단위 오프셋. 한국이면 `540`. */
export function localOffsetMinutes(): number {
  // getTimezoneOffset 은 부호가 반대다(한국이 -540). 사람이 읽는 방향으로 뒤집는다.
  return -new Date().getTimezoneOffset();
}
