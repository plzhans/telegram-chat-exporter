/**
 * 웹 빌드의 로케일 출처.
 *
 * 로케일 파일을 전부 끌어모아 번들에 인라인한다. 언어를 늘릴 때 이 파일을 고칠 일이 없다.
 *
 * 단일 파일 배포는 이 파일 대신 `resources.standalone.ts` 를 쓴다 — 빌드가 별칭으로
 * 갈아끼운다(`vite.config.ts` 의 `@i18n-resources`). 그쪽은 로케일을 번들에 넣지 않고
 * `i18n/<코드>.js` 로 따로 내보낸 값을 읽는다.
 */
const files = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*.json', {
  eager: true,
});

export const resources = Object.fromEntries(
  Object.entries(files).map(([path, mod]) => [
    path.replace('./locales/', '').replace('.json', ''),
    { translation: mod.default },
  ]),
);
