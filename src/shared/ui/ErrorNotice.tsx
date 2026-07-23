import { useTranslation } from 'react-i18next';
import { Alert } from '@/shared/ui/Alert';
import type { TelegramErrorInfo } from '@/shared/telegram/errors';

/**
 * 텔레그램 에러 한 건을 사용자 언어로 보여준다.
 *
 * FLOOD_WAIT 은 초 단위로 오는데 값이 3초일 때도 있고 86400초(하루)일 때도 있다. 초로만
 * 찍으면 "86400초 후에 다시 시도하세요"가 되어 사용자가 감을 못 잡으므로 단위를 접어 준다.
 */
function useDuration() {
  const { t } = useTranslation();
  return (seconds: number) => {
    if (seconds < 60) return t('errors.duration.seconds', { count: seconds });
    if (seconds < 3600) return t('errors.duration.minutes', { count: Math.ceil(seconds / 60) });
    return t('errors.duration.hours', { count: Math.ceil(seconds / 3600) });
  };
}

export function ErrorNotice({ error }: { error: TelegramErrorInfo | null }) {
  const { t } = useTranslation();
  const formatDuration = useDuration();
  if (!error) return null;

  const message = t(`errors.${error.code}`, {
    raw: error.raw,
    duration: error.waitSeconds ? formatDuration(error.waitSeconds) : '',
    defaultValue: error.raw,
  });

  return (
    <Alert tone="warning" title={t('errors.title')}>
      {message}
    </Alert>
  );
}
