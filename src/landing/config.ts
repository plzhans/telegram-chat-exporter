/**
 * 랜딩이 바깥으로 거는 주소.
 *
 * **`src/shared/config/app.ts` 가 아니라 여기에 있는 이유가 있다.** 그 파일은
 * `import.meta.env` 와 `__APP_VERSION__` 을 읽는데, 둘 다 Vite 가 **앱을 묶을 때** 채워
 * 주는 값이다. 랜딩은 빌드 도중 Node 에서 한 번 그려지고 끝나므로(`Landing.tsx` 주석)
 * 그때는 둘 다 없다 - 가져다 쓰면 빌드가 죽는다.
 *
 * 그래서 여기에는 **빌드 시점에 이미 아는 값만** 둔다. 저장소 주소처럼 환경에서 오는
 * 것은 `env.sourceUrl` 로 넘겨받는다(`context.tsx` 의 `LandingEnv`).
 */

/**
 * 릴리스에 올라가는, **버전이 안 붙는** 에셋 이름.
 *
 * 릴리스 워크플로는 같은 zip 을 `telegram-exporter-v1.2.3.zip` 과 이 이름으로 두 번
 * 올린다. 버전이 붙은 쪽은 받아 둔 사람이 파일만 보고 버전을 알기 위한 것이고, 이쪽은
 * 아래 고정 주소용이다 - 에셋 이름이 릴리스마다 바뀌면 사이트에 적어 둘 문자열이 없다.
 *
 * **`.github/workflows/release.yml` 의 `ASSET_LATEST` 와 같아야 한다.** 한쪽만 고치면
 * 빌드도 릴리스도 통과하는데 내려받기 버튼만 404 가 되므로, 릴리스 전에 워크플로가 이
 * 줄을 직접 대조한다.
 */
export const RELEASE_ASSET = 'telegram-exporter.zip';

/**
 * 최신 배포본을 내려받는 주소.
 *
 * `latest` 는 태그 이름이 아니라 GitHub 가 "Latest 배지가 붙은 릴리스" 로 풀어 주는
 * 예약어다. 그래서 버전을 박지 않아도 늘 최신 릴리스를 가리키고, 릴리스를 낼 때마다
 * 사이트를 고칠 일이 없다.
 *
 * 저장소가 아닌 다른 곳(자체 서버·CDN 등)에서 받게 하려면 이 함수만 바꾸면 된다 -
 * 화면 쪽(`sections/Download.tsx`)은 주소가 어디서 오는지 모른다.
 *
 * @param sourceUrl 이 빌드가 아는 저장소 주소. `VITE_SOURCE_URL` 에서 오므로 포크해도
 *   따라간다.
 */
export const releaseDownloadUrl = (sourceUrl: string): string =>
  `${sourceUrl.replace(/\/$/, '')}/releases/latest/download/${RELEASE_ASSET}`;
