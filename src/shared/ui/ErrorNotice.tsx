import { useTranslation } from 'react-i18next';
import { Alert } from '@/shared/ui/Alert';
import type { TelegramErrorInfo } from '@/shared/telegram/errors';
import { useDuration } from '@/shared/lib/duration';

/** 텔레그램 에러 한 건을 사용자 언어로 보여준다. */
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
