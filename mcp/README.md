# `mcp/` — 이 저장소 전용 MCP 서버

이 폴더의 서버들은 **이 저장소를 다룰 때만 쓰는 도구**다. 저장소를 여는 사람(사람이든 에이전트든)이
어딘가에 적어 둔 설정을 찾아 읽지 않아도 되도록, 규칙을 실행 가능한 형태로 둔 것이다.
루트 [`.mcp.json`](../.mcp.json) 이 등록하므로 MCP 클라이언트는 저장소를 열면 바로 잡는다.

의존성을 쓰지 않는다. 하나라도 들이면 `mcp/` 가 루트·`landing/` 에 이은 세 번째 독립 pnpm
프로젝트가 되는데, MCP 는 줄 단위 JSON-RPC 라 직접 받는 편이 싸다. 설치할 것이 없으니
`node` 만 있으면 바로 돈다.

각 서버는 MCP 로도, 손으로도 돌아간다. 어느 쪽으로 돌리든 설정은 한 곳(서버 파일)에만 있다.

## `landing-webp` — 스크린샷 WebP 짝 맞추기

[`landing/src/sections/Screenshots.tsx`](../landing/src/sections/Screenshots.tsx) 는 `<picture>` 로
WebP 를 먼저 걸고 PNG 는 폴백으로만 남긴다. **그래서 PNG 만 고치면 사실상 모든 브라우저가 옛
그림을 계속 본다** — 고친 사람 화면에서도 그대로라 배포하고 나서야 안다. 이 서버가 짝을 맞춘다.

```sh
make landing-webp         # 어긋난 WebP 를 다시 만든다
make landing-webp-check   # 어긋난 게 있으면 exit 1 (훅·CI 용)
```

`landing/public/*.png` 나 `landing/public/en/*.png` 를 고쳤다면 커밋 전에 `make landing-webp` 를
돌린다. 내용이 이미 같은 파일은 건드리지 않으니 전부 돌려도 된다.

인코딩 설정은 `cwebp -q 82 -m 6` 이다. 저장소에 있던 36장을 이 값으로 다시 누르면 **바이트
단위로 같은 파일**이 나온다 — 그래서 '고칠 것'을 mtime 이 아니라 내용 비교로 판정한다.
mtime 은 `git checkout` 한 번에 전부 갱신돼 믿을 수 없다. (설정 자체는 기존 파일의 VP8 헤더에서
역산했다. 저장소 어디에도 안 적혀 있었고, 그래서 이 도구가 생겼다.)

`cwebp` 가 필요하다: `brew install webp`. 저장소의 WebP 는 libwebp 1.6.0 으로 만들었고, 버전이
다르면 내용이 그대로인 그림까지 다시 써질 수 있다(설정은 같으니 품질은 그대로다). 그때는 결과에
버전이 같이 찍힌다.
