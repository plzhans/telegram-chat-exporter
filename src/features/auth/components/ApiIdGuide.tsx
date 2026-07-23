import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { MY_TELEGRAM_URL } from '@/shared/config/app';

/** 굵게만 허용한다. 안내 문구의 `<b>` 를 그대로 살리기 위한 최소 매핑. */
const RICH = { b: <b className="font-semibold" /> };

function Step({ index, children }: { index: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[0.7rem] font-bold text-slate-600">
        {index}
      </span>
      <div className="flex-1 space-y-2">{children}</div>
    </li>
  );
}

/** my.telegram.org 폼에 그대로 옮겨 적을 수 있게 보여주는 값들. */
function FormExample() {
  const { t } = useTranslation();
  const empty = <span className="italic text-slate-400">({t('credentials.guide.empty')})</span>;

  const rows: { label: string; value: ReactNode; note?: string }[] = [
    { label: t('credentials.guide.fields.appTitle'), value: 'TelegramExporter' },
    {
      label: t('credentials.guide.fields.shortName'),
      value: 'tgexporter',
      note: t('credentials.guide.shortNameNote'),
    },
    { label: t('credentials.guide.fields.url'), value: empty },
    { label: t('credentials.guide.fields.platform'), value: 'Web' },
    { label: t('credentials.guide.fields.description'), value: empty },
  ];

  return (
    <dl className="space-y-1.5 rounded-lg bg-slate-50 p-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-slate-500">{row.label}</dt>
            <dd className="min-w-0 flex-1 font-mono text-slate-800">{row.value}</dd>
          </div>
          {/* 라벨 열(w-24 = 6rem) + gap-2(0.5rem) 만큼 들여써서 값과 왼쪽을 맞춘다. */}
          {row.note && <p className="mt-1 pl-[6.5rem] text-slate-500">{row.note}</p>}
        </div>
      ))}
    </dl>
  );
}

/**
 * ERROR 만 뜨고 앱이 안 만들어질 때의 대처법.
 *
 * my.telegram.org 의 앱 생성 폼은 실패 이유를 전혀 알려주지 않는다. 그래서 여기 막히면
 * 사용자는 원인을 짐작할 방법이 없고 그대로 이탈한다. 발생 빈도 순으로 나열해서, 위에서부터
 * 훑으면 대부분 풀리게 한다.
 *
 * 기본으로 접어 두는 이유는 이게 **예외 경로**이기 때문이다. 잘 되는 사람에게까지 긴 문제
 * 해결 목록을 먼저 보여주면 "이거 원래 잘 안 되는 거구나" 하고 시작 전에 포기한다.
 */
function Troubleshooting() {
  const { t } = useTranslation();
  const keys = ['reload', 'vpn', 'extensions', 'shortName', 'spambot', 'wait'] as const;

  return (
    <details className="group rounded-lg border border-slate-200">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-semibold text-slate-700 marker:content-none">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        {t('credentials.guide.trouble.title')}
      </summary>

      <div className="space-y-2 border-t border-slate-100 px-3 py-2.5">
        <p className="text-slate-500">{t('credentials.guide.trouble.intro')}</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-slate-600 marker:text-slate-400">
          {keys.map((key) => (
            <li key={key}>
              <Trans i18nKey={`credentials.guide.trouble.${key}`} components={RICH} />
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

export function ApiIdGuide() {
  const { t } = useTranslation();

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed">
      <h3 className="text-sm font-bold text-slate-900">{t('credentials.guide.title')}</h3>

      <ol className="space-y-3 text-slate-600">
        <Step index={1}>
          <p>{t('credentials.guide.step1')}</p>
          <a
            href={MY_TELEGRAM_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2"
          >
            {t('credentials.open')}
            <ExternalLink className="h-3 w-3" />
          </a>
        </Step>

        <Step index={2}>
          <p>
            <Trans i18nKey="credentials.guide.step2" components={RICH} />
          </p>
          <FormExample />
        </Step>

        <Step index={3}>
          <p>{t('credentials.guide.step3')}</p>
        </Step>
      </ol>

      <Troubleshooting />
    </section>
  );
}
