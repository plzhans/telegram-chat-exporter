import { Trans, useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { Disclosure } from '@/shared/ui/Disclosure';
import { SOURCE_URL } from '@/shared/config/app';
import { IDLE_TTL_MINUTES } from '@/shared/telegram/session';
import { ADS_ENABLED, ANALYTICS_ENABLED } from '@/shared/analytics/gtag';

/**
 * 첫 화면 맨 위에 붙는 설명.
 *
 * 이 도구의 가장 큰 장벽은 기능이 아니라 **"전화번호와 로그인 코드를 처음 보는 웹사이트에
 * 입력하라"는 요구** 자체다. 텔레그램이 코드 메시지에 "누구에게도 알려주지 마세요"라고
 * 직접 써서 보내기 때문에, 의심하는 게 정상이고 그 의심을 부정하면 오히려 더 수상해진다.
 *
 * 그래서 순서를 이렇게 잡았다.
 * 1. **무엇을 위한 페이지인지** 한 줄로 밝힌다. 목적이 흐릿하면 나머지 설명이 변명처럼 읽힌다.
 * 2. 동작 방식을 셋으로 나눠 설명한다.
 * 3. **직접 확인하는 방법**을 준다. 믿어 달라는 말보다 확인 절차가 낫다.
 * 4. 남는 것을 **표로** 못 박는다. 문장으로 풀어 쓰면 "이게 전부인가"가 안 드러난다.
 * 5. 경고를 숨기지 않고 그대로 반복한다.
 *
 * 용어는 처음 나올 때 한 번 풀어 준다 — "크롬·사파리처럼 인터넷을 보는 프로그램을
 * 브라우저라고 하는데" 하고 나면, 이후로는 그냥 브라우저라고 써도 된다. 매번 풀어 쓰면
 * 오히려 읽기 어려워진다.
 */
export function TrustPanel() {
  const { t } = useTranslation();

  /**
   * 동작 방식. 화면 순서가 곧 신뢰의 순서다 — 서버 없음이 가장 먼저다.
   *
   * 전화번호·로그인 코드 이야기는 여기서 뺐다. 첫 화면에서는 아직 남의 일이라 그냥 넘어가고,
   * 정작 그 말이 필요한 곳은 **입력칸 바로 위**다(LoginCodeNotice 참고).
   */
  const points = ['noServer', 'download'] as const;

  /**
   * 남는 것의 전체 목록.
   *
   * **여기 없는 것은 안 남는다**는 뜻으로 읽히므로, 저장소를 하나 늘릴 때마다 이 표에도
   * 줄을 하나 늘려야 한다. 빠뜨리면 "아무것도 저장하지 않는다"는 설명이 거짓이 된다.
   */
  const rows = [
    {
      kind: t('trust.stored.sessionKind'),
      where: t('trust.stored.sessionWhere'),
      until: t('trust.stored.sessionUntil', { minutes: IDLE_TTL_MINUTES }),
      note: t('trust.stored.sessionNote'),
    },
    {
      kind: t('trust.stored.stickerKind'),
      where: t('trust.stored.stickerWhere'),
      until: t('trust.stored.stickerUntil'),
      note: t('trust.stored.stickerNote'),
    },
  ];

  const inline = {
    code: <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[0.85em]" />,
    strong: <strong className="font-semibold" />,
  };

  return (
    <div className="space-y-3">
      <section className="edge-card bg-white p-4">
        <header className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h1 className="text-sm font-bold text-slate-900">{t('trust.purpose')}</h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('trust.lede')}</p>
          </div>
        </header>

        <h2 className="mt-4 text-xs font-bold text-slate-900">{t('trust.how.title')}</h2>
        {/*
          세 가지를 **한 상자 안에** 담는다.

          처음에는 항목마다 상자를 따로 뒀는데, 짧은 글 세 개가 각자 테두리를 두르니 화면이
          잘게 쪼개져서 하나의 설명으로 읽히지 않았다. 이건 서로 다른 이야기 셋이 아니라
          "어떻게 동작하는가" 하나에 대한 세 문단이다.
        */}
        <div className="mt-2 divide-y divide-slate-200 rounded-xl bg-slate-50 px-3">
          {points.map((key) => (
            <div key={key} className="py-2">
              <p className="text-xs font-semibold text-slate-900">{t(`trust.how.${key}.title`)}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                {t(`trust.how.${key}.body`)}
              </p>
            </div>
          ))}
        </div>

      </section>

      {/*
        아래 셋은 **접어서, 한 상자에 묶어 둔다.**

        이 도구를 믿을지 판단하려는 사람에게는 꼭 필요한 글이지만, 다 펼쳐 두면 정작 로그인
        칸이 화면 한참 아래로 밀린다. 신뢰를 설명하려다 도구를 못 쓰게 만드는 셈이다.

        상자를 각자 두르지 않는 이유도 같다. 카드 세 개는 그만큼 자리를 더 먹고, 서로 다른
        이야기처럼 보인다. 실은 **"이 사이트를 믿어도 되나"라는 한 질문에 대한 세 갈래**다.

        대신 접힌 상태에서도 **무슨 이야기인지 한 줄로 알 수 있게** 요약을 붙인다. 제목만
        있으면 열어 봐야 아는지 몰라 그냥 지나친다.
      */}
      <div className="divide-y divide-slate-200 overflow-hidden edge-card bg-white">
      <Disclosure bare title={t('trust.verify.title')} summary={t('trust.verify.peek')}>
        <ul className="space-y-1 text-xs leading-relaxed text-slate-600">
          <li className="flex gap-2">
            <span aria-hidden className="text-slate-400">
              1.
            </span>
            <span>
              <Trans
                i18nKey={ANALYTICS_ENABLED ? 'trust.verify.cspAnalytics' : 'trust.verify.csp'}
                components={inline}
              />
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-slate-400">
              2.
            </span>
            <span>
              <Trans i18nKey="trust.verify.devtools" components={inline} />
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-slate-400">
              3.
            </span>
            <span>
              {t('trust.verify.source')}{' '}
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-primary underline underline-offset-2"
              >
                {t('common.source')}
              </a>
            </span>
          </li>
        </ul>
      </Disclosure>

      <Disclosure bare title={t('trust.stored.title')} summary={t('trust.stored.peek')}>
        <p className="text-xs leading-relaxed text-slate-600">{t('trust.stored.lede')}</p>

        {/*
          좁은 화면에서 표가 화면을 뚫고 나가지 않도록 가로 스크롤을 이 안에만 둔다.
          몸통에 스크롤이 생기면 페이지 전체가 좌우로 흔들린다.
        */}
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-start text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th scope="col" className="py-1.5 pe-3 font-medium">
                  {t('trust.stored.colKind')}
                </th>
                <th scope="col" className="py-1.5 pe-3 font-medium">
                  {t('trust.stored.colWhere')}
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  {t('trust.stored.colUntil')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.kind} className="border-b border-slate-100 align-top last:border-0">
                  <td className="py-2 pe-3 font-semibold text-slate-900">
                    {row.kind}
                    {/*
                      "왜 이건 남기는가"를 그 줄 바로 아래에 붙인다. 표 밖으로 빼면 어느
                      줄에 대한 설명인지 다시 눈으로 짚어야 한다.
                    */}
                    <span className="mt-0.5 block font-normal leading-relaxed text-slate-500">
                      {row.note}
                    </span>
                  </td>
                  <td className="py-2 pe-3 text-slate-700">{row.where}</td>
                  <td className="py-2 leading-relaxed text-slate-700">{row.until}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs font-semibold text-slate-900">{t('trust.never.title')}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{t('trust.never.body')}</p>
      </Disclosure>

      {/*
        신뢰 설명의 **뒷면**이다.

        "거쳐 가는 서버가 없다"는 장점만 말하면, 큰 대화방이 휴대폰에서 느리거나 멈출 때
        사용자는 그걸 고장으로 읽는다. 서버가 없다는 것과 내 기기가 다 한다는 것은 같은
        사실의 양면이라, 같은 화면에서 함께 말해야 한다.
      */}
      {/*
        애널리틱스를 켠 빌드에서만 나온다. 이 앱은 "다른 곳으로 연결하지 못한다"를 근거로
        신뢰를 청하므로, 유일한 예외를 숨기면 그 근거 전체가 무너진다.
      */}
      {ANALYTICS_ENABLED && (
        <Disclosure bare title={t('trust.analytics.title')} summary={t('trust.analytics.peek')}>
          <p className="text-xs leading-relaxed text-slate-600">
            <Trans i18nKey="trust.analytics.lede" components={inline} />
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            <Trans i18nKey="trust.analytics.network" components={inline} />
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
            <li>{t('trust.analytics.sent')}</li>
            <li>
              <Trans i18nKey="trust.analytics.notSent" components={inline} />
            </li>
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {t('trust.analytics.block')}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            <Trans i18nKey="trust.analytics.selfHost" components={inline} />{' '}
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-primary underline underline-offset-2"
            >
              {t('common.source')}
            </a>
          </p>
        </Disclosure>
      )}

      {ADS_ENABLED && (
        <Disclosure bare title={t('trust.ads.title')} summary={t('trust.ads.peek')}>
          <p className="text-xs leading-relaxed text-slate-600">
            <Trans i18nKey="trust.ads.body" components={inline} />
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            <Trans i18nKey="trust.ads.isolation" components={inline} />
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            <Trans i18nKey="trust.ads.selfHost" components={inline} />
          </p>
        </Disclosure>
      )}

      <Disclosure bare title={t('trust.device.title')} summary={t('trust.device.peek')}>
        <p className="text-xs leading-relaxed text-slate-600">{t('trust.device.body')}</p>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
          {(['bigChat', 'keepOpen', 'rate'] as const).map((key) => (
            <li key={key} className="flex gap-2">
              <span aria-hidden className="text-slate-400">
                ·
              </span>
              <span>{t(`trust.device.${key}`)}</span>
            </li>
          ))}
        </ul>
      </Disclosure>
      </div>

      {/*
        마지막에 오는 경고.

        예전 문구는 "의심하세요"와 "그래도 쓰세요" 사이에서 어정쩡했다. 경고만 하고 물러나면
        읽는 사람은 **그래서 어쩌라는 건지** 알 수 없다. 순서를 이렇게 못 박았다.

        1. 원칙이 옳다고 먼저 인정한다. 부정하면 그때부터 나머지 말이 안 들린다.
        2. **그럼에도 요구하는 이유**를 밝힌다. 계정으로 접속해야 대화를 가져올 수 있다.
        3. 그 대신 무엇을 보장하는지 — 어디에도 저장하지 않고, 탭을 닫으면 사라진다.
        4. **믿지 말고 확인하라**는 길을 준다. 소스를 읽거나 직접 띄우면 된다. 이 마지막이
           핵심이다 — "믿어 달라"로 끝나는 안내는 사기와 구별되지 않는다. 구별되는 건
           **안 믿어도 되는 방법을 함께 주는 쪽**이다.
      */}
    </div>
  );
}
