import { releaseDownloadUrl } from '../config';
import { useLanding } from '../context';
import { Download as DownloadIcon } from '../icons';
import { Cta } from '../ui';

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
