/**
 * 첫 화면. **앱과 달리 브라우저에서 돌지 않는다.**
 *
 * 이 컴포넌트는 빌드할 때 `renderToStaticMarkup` 으로 한 번 그려져 HTML 문자열이 되고,
 * 거기서 끝난다(`vite.config.ts` 의 `localizedPages`). 그래서 랜딩에는 자바스크립트가
 * 한 바이트도 실리지 않는다. 이유는 둘이다.
 *
 * 1. **검색엔진.** 구글은 JS 를 실행하지만 크롤과 렌더가 다른 큐라 며칠씩 밀리고,
 *    네이버·다음·GPTBot 같은 크롤러는 사실상 못 읽는다. 검색으로 사람을 데려오는 것이
 *    이 화면의 존재 이유이므로, 본문이 HTML 안에 그대로 있어야 한다.
 *
 * 2. **무게.** 앱 번들에는 MTProto 라이브러리(GramJS)가 들어 있어 gzip 530KB 다. 홍보
 *    한 장 보여주려고 그걸 받게 하면 LCP·INP 가 나빠지는데, 그 둘은 검색 순위에 직접
 *    들어가는 신호다. 이 문서는 CSS 하나만 받는다.
 *
 * **그래서 훅도 상태도 이벤트 핸들러도 쓰면 안 된다.** `onClick` 을 달아도 아무 일도
 * 일어나지 않는다 - 그것을 실행할 JS 가 문서에 없다. 움직임이 필요하면 `<details>` 처럼
 * 브라우저가 스스로 하는 것을 쓴다(`ui.tsx` 의 `LanguageMenu` 가 그 예다).
 *
 * ---
 *
 * **문구는 여기 없다.** 전부 `src/shared/i18n/locales/<언어>.json` 의 `landing` 블록에
 * 있고, 앱 화면과 같은 파일·같은 키다. 여기에 한국어나 영어를 적으면 언어를 늘릴 때 두
 * 곳을 고쳐야 하고 곧 어긋난다.
 *
 * 섹션을 더하려면 `sections/` 에 파일 하나를 만들고 아래에 한 줄을 넣는다. 순서도 이
 * 목록 그대로다.
 */

import { LandingProvider, type LandingValue } from './context';
import { Header } from './sections/Header';
import { Hero } from './sections/Hero';
import { Why } from './sections/Why';
import { Zip } from './sections/Zip';
import { Steps } from './sections/Steps';
import { Verify } from './sections/Verify';
import { Final } from './sections/Final';
import { Footer } from './sections/Footer';

export function Landing(value: LandingValue) {
  return (
    <LandingProvider value={value}>
      <Header />
      <main>
        <Hero />
        <Why />
        <Zip />
        <Steps />
        <Verify />
        <Final />
      </main>
      <Footer />
    </LandingProvider>
  );
}
