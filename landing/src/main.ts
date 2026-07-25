import './globals.css';

/*
  랜딩의 클라이언트 진입점(Vite 관례상 `main`).

  **JSX 를 여기 두지 않는다.** react-jsx 변환이 모듈 최상단에 `react/jsx-runtime` import 를
  넣는데, 그건 부작용이 있어(CJS interop) 죽은 분기 안에 있어도 트리셰이킹되지 않는다. 그래서
  React 를 쓰는 부분은 전부 `mount.tsx` 로 빼고 **동적 import** 로만 부른다.

  - **SSG(프로덕션)**: `__LANDING_SPA__` 가 `false` 라 아래 블록째 사라진다 → `mount` 청크가
    아예 안 생기고, 남는 건 위 `globals.css` 뿐이다. 본문은 빌드가 프리렌더한 정적 HTML.
  - **SPA(개발·미리보기)**: `mount()` 가 브라우저에서 <Landing> 을 그린다(HMR·devtools).
*/
if (__LANDING_SPA__) {
  void import('./mount').then((m) => m.mount());
}
