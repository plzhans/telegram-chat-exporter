import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { useAuth } from '@/shared/auth/useAuth';
import { IDLE_TTL_MINUTES } from '@/shared/telegram/session';

/**
 * 저장된 로그인 정보를 이어가지 못했을 때 한 번 띄우는 안내.
 *
 * 없으면 사용자는 "분명 로그인돼 있었는데 갑자기 로그인 화면"만 보게 되고, 그건 앱이 고장 난
 * 것처럼 읽힌다. 이유를 말해 주는 것만으로 같은 화면이 납득 가능한 화면이 된다.
 *
 * 처음 방문한 사람에게는 뜨지 않는다 — 저장본이 아예 없던 경우(`none`)와 만료된 경우를
 * shared/telegram/session.ts 에서 구분해 두었다.
 */
export function SessionNotice() {
  const { t } = useTranslation();
  const notice = useAuth((s) => s.notice);
  const dismiss = useAuth((s) => s.dismissNotice);

  // 알릴 게 없으면 아예 마운트하지 않는다. 닫힌 <dialog> 는 화면에 안 보이지만 그 안의
  // 문구는 DOM 에 그대로 남는데, 안 띄울 안내문을 넣어 둘 이유가 없다.
  if (!notice) return null;

  return (
    <Modal
      open
      onClose={dismiss}
      title={t(`sessionNotice.${notice}.title`)}
      footer={
        <Button size="sm" onClick={dismiss}>
          {t('sessionNotice.confirm')}
        </Button>
      }
    >
      {t(`sessionNotice.${notice}.body`, { minutes: IDLE_TTL_MINUTES })}
    </Modal>
  );
}
