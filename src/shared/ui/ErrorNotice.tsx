import { useTranslation } from 'react-i18next';
import { Alert } from '@/shared/ui/Alert';
import type { TelegramErrorInfo } from '@/shared/telegram/errors';
import { useCountdown, useDuration } from '@/shared/lib/duration';

/** 텔레그램 에러 한 건을 사용자 언어로 보여준다. */
export function ErrorNotice({ error }: { error: TelegramErrorInfo | null }) {
  const { t } = useTranslation();
  const formatDuration = useDuration();

  /*
    훅은 조기 return 앞에 둔다. `error` 가 있는 렌더와 없는 렌더에서 훅 개수가 달라지면
    리액트가 상태를 엇갈리게 집는다.
  */
  const remain = useCountdown(error?.waitUntil);

  if (!error) return null;

  /*
    **제한이 풀렸으면 알림을 지운다.**

    남은 시간이 0 이 된 순간 이 문구는 사실이 아니게 된다. "0초 후에 다시 시도해 주세요"
    라고 적어 두느니 사라지는 편이 맞다 — 다시 눌러도 되는 상태라는 뜻이 그대로 전달되고,
    새 문구를 열다섯 개 언어에 만들어 넣을 일도 없다. 아직 안 풀렸다면 텔레그램이 새 시간을
    담은 오류를 다시 준다.
  */
  if (remain === 0) return null;

  /*
    남은 시간은 **세어 내려간 값**을 쓴다. `waitSeconds` 는 오류가 도착한 순간의 값이라
    시간이 지날수록 실제보다 길게 말한다. 끝나는 시각이 없는 경로에서만 그 값으로 물러난다.
  */
  const seconds = remain ?? error.waitSeconds;

  const message = t(`errors.${error.code}`, {
    raw: error.raw,
    duration: seconds ? formatDuration(seconds) : '',
    defaultValue: error.raw,
  });

  return (
    <Alert tone="warning" title={t('errors.title')}>
      {message}
    </Alert>
  );
}
