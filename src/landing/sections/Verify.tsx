import { useLanding } from '../context';
import { Shield } from '../icons';
import { Rich } from '../ui';

/**
 * "믿어 달라고 하지 않습니다".
 *
 * 화면에 적는 `connect-src` 는 문구가 아니라 **이 문서에 실제로 걸린 정책**에서 온다.
 * 한 벌 더 적어 두면 애널리틱스를 켜고 끌 때 조용히 거짓말이 된다.
 */
export function Verify() {
  const { text, env, copy } = useLanding();

  /** `connect-src wss://a wss://b` → 지시어 하나와 주소 목록. */
  const [directive, ...sources] = env.connectSrc.split(/\s+/).filter(Boolean);

  return (
    <section className="bg-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <div className="flex gap-3">
          <Shield className="mt-0.5 h-6 w-6 shrink-0 text-primary-400" />
          <div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">{copy.verify.title}</h2>
            <Rich
              className="mt-3 text-sm leading-relaxed text-slate-300"
              text={env.analytics ? copy.verify.bodyAnalytics : copy.verify.body}
            />
            {/*
              한 줄로 늘어놓으면 어디서 끊기는지가 화면 폭에 달려서, 주소 하나가 두 줄에
              걸쳐 잘린다. 이 문단은 사용자가 개발자도구의 값과 **눈으로 대조하는** 것이
              목적이라 그 상태로는 쓸모가 없다. 그래서 지시어 다음에 허용된 주소를 한 줄에
              하나씩 놓는다.
            */}
            <p className="mt-4 rounded-xl bg-slate-800 px-4 py-3 font-mono text-xs leading-relaxed text-slate-300">
              <code dir="ltr" className="block break-words">
                {directive}
                {sources.map((source) => (
                  <span key={source} className="block ps-4">
                    {source}
                  </span>
                ))}
              </code>
            </p>
            <Rich className="mt-4 text-sm leading-relaxed text-slate-300" text={copy.verify.devtools} />
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {copy.verify.source}{' '}
              <a
                href={env.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-primary-300 underline underline-offset-2 hover:text-primary-200"
              >
                {text.common.source}
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
