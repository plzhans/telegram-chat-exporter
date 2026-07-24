import { useLanding } from '../context';
import { Download as DownloadIcon } from '../icons';
import { Cta } from '../ui';

/**
 * 릴리스에 올라가는, **버전이 안 붙는** 에셋 이름.
 *
 * 릴리스 워크플로는 같은 zip 을 `telegram-exporter-v1.2.3.zip` 과 이 이름으로 두 번
 * 올린다. 버전이 붙은 쪽은 받아 둔 사람이 파일만 보고 버전을 알기 위한 것이고, 이쪽은
 * 여기서 거는 고정 주소용이다 - 에셋 이름이 릴리스마다 바뀌면 사이트에 적어 둘 문자열이
 * 없다.
 *
 * **`.github/workflows/release.yml` 의 `ASSET_LATEST` 와 같아야 한다.** 한쪽만 고치면
 * 빌드도 릴리스도 통과하는데 아래 버튼만 404 가 되므로, 릴리스 전에 워크플로가 이 줄을
 * 직접 대조한다.
 */
export const RELEASE_ASSET = 'telegram-exporter.zip';

/**
 * 그 에셋의 영구 주소.
 *
 * `latest` 는 태그 이름이 아니라 GitHub 가 "Latest 배지가 붙은 릴리스" 로 풀어 주는
 * 예약어다. 그래서 버전을 박지 않아도 늘 최신 릴리스를 가리킨다. 저장소 주소는 빌드가
 * 아는 값(`VITE_SOURCE_URL`)에서 오므로 포크해도 따라간다.
 */
export const releaseDownloadUrl = (sourceUrl: string): string =>
  `${sourceUrl.replace(/\/$/, '')}/releases/latest/download/${RELEASE_ASSET}`;

/**
 * 내려받기는 히어로가 아니라 **여기**에 둔다.
 *
 * 히어로의 lede 가 "깔 것이 없습니다" 라서, 그 옆에 내려받기 버튼을 붙이면 첫 화면이
 * 스스로와 싸운다. 바로 앞 "믿어 달라고 하지 않습니다" 다음에 오면 "그럼 받아서 직접
 * 열어 보라" 로 읽혀, 같은 버튼이 오히려 그 논지를 잇는다.
 */
export function Download() {
  const { env, copy } = useLanding();

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{copy.download.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{copy.download.body}</p>
          </div>
          <Cta href={releaseDownloadUrl(env.sourceUrl)} variant="dark" className="shrink-0">
            <DownloadIcon className="h-5 w-5" />
            {copy.download.cta}
          </Cta>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-slate-400">{copy.download.note}</p>
      </div>
    </section>
  );
}
