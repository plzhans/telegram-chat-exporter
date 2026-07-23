import { useTranslation } from 'react-i18next';
import { Alert } from '@/shared/ui/Alert';
import { SOURCE_URL } from '@/shared/config/app';

/**
 * 전화번호·로그인 코드를 입력하는 자리에 붙는 경고.
 *
 * **첫 화면이 아니라 여기 있어야 한다.** 처음 들어온 사람에게 "로그인 코드를 요구합니다"는
 * 아직 남의 일이라 그냥 넘긴다. 그 말이 실제로 무게를 갖는 건 **입력칸에 번호를 적으려는
 * 순간**이다. 망설임이 생기는 자리에 답이 있어야 한다.
 *
 * 순서를 이렇게 못 박았다.
 * 1. 원칙이 옳다고 먼저 인정한다. 부정하면 그때부터 나머지 말이 안 들린다.
 * 2. **그럼에도 요구하는 이유**를 밝힌다. 계정으로 접속해야 대화를 가져올 수 있다.
 * 3. 그 대신 무엇을 보장하는지 — 어디에도 저장하지 않고, 탭을 닫으면 사라진다.
 * 4. **믿지 말고 확인하라**는 길을 준다. 소스를 읽거나 직접 띄우면 된다. 이 마지막이
 *    핵심이다 — "믿어 달라"로 끝나는 안내는 사기와 구별되지 않는다. 구별되는 건
 *    **안 믿어도 되는 방법을 함께 주는 쪽**이다.
 *
 * 본문만 한 단계 작게 쓴다. 제목은 그대로 둔다 — 못 보고 지나치는 일은 없어야 한다.
 */
export function LoginCodeNotice() {
  const { t } = useTranslation();

  return (
    <Alert tone="warning" title={t('trust.warning.title')} className="text-xs">
      <p>{t('trust.warning.principle')}</p>
      <p className="mt-1.5">{t('trust.warning.why')}</p>
      <p className="mt-1.5">{t('trust.warning.storage')}</p>
      <p className="mt-1.5">
        {t('trust.warning.selfHost')}{' '}
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold underline underline-offset-2"
        >
          {t('common.source')}
        </a>
      </p>
    </Alert>
  );
}
