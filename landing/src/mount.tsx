import { createRoot } from 'react-dom/client';
import { Landing } from './Landing';
import { landingProps } from './clientProps';

/*
  SPA(개발·미리보기)에서 <Landing> 을 브라우저에 그린다. `main.ts` 가 `__LANDING_SPA__` 일
  때만 동적 import 로 부르므로, SSG 번들에는 이 파일도 React 도 들어가지 않는다.
*/
export function mount(): void {
  const root = document.getElementById('root');
  if (!root) return;
  createRoot(root).render(<Landing {...landingProps()} />);
  /*
    스크린샷 슬라이더는 렌더된 DOM 을 스캔해 초기화된다(`slider.ts`). React 커밋 뒤에
    붙여야 하므로 한 프레임 미룬다 — 늦어도 마크업이 가로 스크롤로 이미 동작한다.
  */
  requestAnimationFrame(() => void import('./slider'));
}
