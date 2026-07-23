import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 끝나는 시각까지 남은 초를 1초마다 다시 센다. 대기 중이 아니면 null.
 *
 * **초가 아니라 시각을 받는다.** 남은 초를 받아서 스스로 깎으면 탭이 잠들어 있던 동안의
 * 시간이 통째로 빠진다 - 휴대전화에서 화면을 끄고 30분 뒤에 돌아오면 30분이 그대로 남아
 * 있는 셈이 된다. 끝나는 시각에서 지금을 빼면 그런 일이 없다.
 *
 * 0 이 되면 0 을 돌려준다. 사라지게 할지 다른 말을 할지는 부르는 쪽이 정한다.
 */
export function useCountdown(until: number | undefined): number | null {
  const [remain, setRemain] = useState<number | null>(null);

  useEffect(() => {
    if (!until) {
      setRemain(null);
      return;
    }
    const tick = () => setRemain(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);

  return remain;
}

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
