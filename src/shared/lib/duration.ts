import { useTranslation } from 'react-i18next';

/**
 * 초를 사용자 언어의 시간 표기로 접는다.
 *
 * FLOOD_WAIT 은 초 단위로 오는데 값이 3초일 때도 있고 86400초(하루)일 때도 있다. 초로만
 * 찍으면 "86400초 후에 다시 시도하세요"가 되어 사용자가 감을 못 잡으므로 단위를 접어 준다.
 *
 * 오류 문구와 내보내기 중 대기 표시가 **같은 규칙**을 써야 한다. 한쪽만 초로 찍으면 같은
 * 제한을 두고 화면마다 다르게 말하는 셈이 된다.
 */
export function useDuration() {
  const { t } = useTranslation();
  return (seconds: number) => {
    if (seconds < 60) return t('errors.duration.seconds', { count: seconds });
    if (seconds < 3600) return t('errors.duration.minutes', { count: Math.ceil(seconds / 60) });
    return t('errors.duration.hours', { count: Math.ceil(seconds / 3600) });
  };
}
