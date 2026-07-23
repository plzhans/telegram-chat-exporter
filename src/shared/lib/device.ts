/**
 * 지금 기기가 휴대전화·태블릿인가.
 *
 * ## 알아낼 수 있는 것과 없는 것
 *
 * **데이터 요금제로 붙었는지는 알 수 없다.** 그걸 알려 주는 Network Information API 의
 * `connection.type` 은 크로뮴 계열 안드로이드에서만 값이 오고, 그마저도 표준에서 빠지는
 * 방향이다. 그래서 "셀룰러일 때만" 은 만들 수 없다.
 *
 * 대신 **기기 종류**는 꽤 정확히 가른다. 데이터 요금을 걱정할 사람은 거의 휴대전화 쪽이라
 * 목적에는 이걸로 충분하다. 대신 와이파이로 붙은 휴대전화에도 안내가 뜬다 — 안 뜨는 쪽보다
 * 낫다고 봤다. 요금이 나가는 상황을 놓치는 것이 한 번 더 묻는 것보다 나쁘다.
 *
 * ## 판단 근거
 *
 * 1. `userAgentData.mobile` — 브라우저가 직접 답해 주는 값이라 가장 믿을 만하다.
 *    **크로뮴 계열에만 있다.** 사파리·파이어폭스는 여기서 걸리지 않고 아래로 내려온다.
 * 2. 없으면 **손가락이 주된 입력인가**로 본다. 아래 주석 참고.
 */
export function isMobileDevice(): boolean {
  const uaData = (navigator as { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (typeof uaData?.mobile === 'boolean') return uaData.mobile;

  try {
    /*
      **화면 폭으로 재지 않는다.** 예전에는 `pointer: coarse` 에 `innerWidth < 768` 을
      곁들였는데, 그러면 아이패드는 늘 빠지고 아이폰도 가로로 돌리면(844px) 빠진다.
      기기는 그대로인데 돌렸다고 안내가 사라지는 건 말이 안 된다.

      `hover: none` 을 더하는 것이 요점이다. 손가락으로 쓰는 기기는 마우스 커서가 없어서
      hover 를 못 한다. 터치 화면이 달린 노트북은 마우스도 있으므로 `hover: hover` 로 답해
      여기서 빠진다 - 화면 크기와 무관하게 "손가락이 주된 입력인가" 만 본다.
    */
    return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
  } catch {
    return false;
  }
}

/**
 * 사용자가 브라우저·운영체제에 "데이터를 아껴 달라"고 켜 둔 상태인가.
 *
 * 켜 두었다면 요금을 신경 쓰는 사람이 확실하므로, 기기 종류와 상관없이 안내한다.
 */
export function prefersReducedData(): boolean {
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}
