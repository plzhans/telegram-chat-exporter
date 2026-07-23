import { useTranslation } from 'react-i18next';
import { Paperclip, Play } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { MessageSummary } from '../api';
import { Avatar } from './Avatar';
import { MediaInfoButton } from './MediaInfoButton';
import { MessagePhoto } from './MessagePhoto';

/**
 * 말풍선 옆에는 **시각만** 적는다.
 *
 * 날짜는 구분선(DateDivider)이 전담한다. 한때 연·월·일을 다 찍었다가 월·일로 줄였는데,
 * 어느 쪽이든 구분선과 같은 정보가 말풍선마다 반복될 뿐이라 읽기만 나빠졌다.
 */
export function formatTime(unixSeconds: number, locale: string): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    // 한국어 로케일은 기본이 오전/오후라 명시해야 24시간제가 된다.
    hour12: false,
  });
}

/**
 * 시각 앞에 붙는 "수정됨" 표시.
 *
 * 기록을 근거로 쓸 때 **원문 그대로인지 나중에 손댄 것인지**는 다른 사실이다. 텔레그램이
 * `editDate` 로 알려주니 감출 이유가 없다.
 */
export function EditedMark({ message, muted }: { message: MessageSummary; muted: string }) {
  const { t } = useTranslation();
  if (!message.editDate) return null;
  return <span className={cn('me-1', muted)}>{t('messages.edited')}</span>;
}

interface MessageRowProps {
  message: MessageSummary;
  /**
   * 아바타와 이름을 실제로 그릴지. 같은 사람이 연달아 말하면 false 로 와서, 자리만 비워 두고
   * 반복을 줄인다(메신저들이 하는 그 방식).
   */
  showSender?: boolean;
}

export function MessageRow({ message, showSender = true }: MessageRowProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'ko';

  /**
   * 시스템 메시지(입장·나가기·제목 변경 등)는 말풍선이 아니라 가운데 한 줄로 둔다.
   * 말풍선으로 그리면 누가 한 말인 것처럼 보인다.
   */
  if (message.actionType && !message.text) {
    /*
      "chatdeleteuser" 같은 **텔레그램 내부 이름을 그대로 보여주면 안 된다.** 사람이 읽는
      화면이고, 실제로는 "누가 나갔다"는 흔한 일이다.

      아는 종류는 문장으로 바꾸고, 모르는 종류는 원래 이름을 그대로 둔다 - 새 종류가
      생겼을 때 "알 수 없음"으로 뭉개면 무슨 일이 있었는지 되짚을 수가 없다.
    */
    const what = t(`messages.actionKind.${message.actionType}`, { defaultValue: '' });
    return (
      <li className="py-1 text-center text-xs text-slate-400">
        {what
          ? t('messages.actionBy', { name: message.senderName ?? '', what })
          : t('messages.action', { type: message.actionType })}
      </li>
    );
  }

  const incoming = !message.out;

  return (
    <li className={cn('flex items-end gap-2', message.out && 'flex-row-reverse')}>
      {incoming &&
        (showSender ? (
          <Avatar
            id={message.senderId ?? String(message.id)}
            title={message.senderName ?? ''}
            kind="user"
            photo={message.senderPhoto}
            /**
             * 선명한 사진을 받는다. 캐시가 **발신자 id 기준**이라 같은 사람이 수백 번
             * 말해도 요청은 한 번이다 — 비용은 메시지 수가 아니라 발신자 수에 비례한다.
             */
            sharp
            className="h-7 w-7 text-[0.7rem]"
          />
        ) : (
          // 아바타를 안 그려도 자리는 남겨야 말풍선 왼쪽 선이 흔들리지 않는다.
          <span className="h-7 w-7 shrink-0" />
        ))}

      <div className={cn('flex min-w-0 flex-col gap-0.5', message.out ? 'items-end' : 'items-start')}>
        {/*
          이름은 **말풍선 안 첫 줄**에 둔다.

          밖에 두면 말풍선과 이름 사이에 틈이 생겨서, 이름이 그 말풍선의 것인지 바로 위
          미디어의 것인지 눈으로 한 번 더 짚어야 한다. 안에 넣으면 이름과 말이 한 덩어리가
          되어 그 판단이 필요 없어진다.

          글이 없는 메시지(사진만 보낸 경우)는 담을 말풍선이 없으므로 예전처럼 위에 둔다.
        */}
        {incoming && showSender && message.senderName && !message.text && (
          <SenderLabel message={message} />
        )}

        {/*
          **미디어는 말풍선 밖에 둔다.** 사진·스티커·영상은 그 자체로 덩어리라, 색칠한 상자에
          담으면 둘레에 띠가 생겨 액자처럼 보인다. 글이 함께 있으면 글만 말풍선에 담고
          미디어는 그 위에 따로 세운다.
        */}
        {message.mediaKey && (
          <div className="relative">
            <MessagePhoto message={message} dark={message.out} />
            <MediaInfoButton message={message} className="absolute end-1.5 top-1.5" />

            {/*
              영상은 썸네일만 보여준다(재생은 원본을 받아야 한다). 그림만 덩그러니 두면
              사진과 구별이 안 되므로 재생 표시를 얹는다.
            */}
            {(message.mediaType === 'video' ||
              message.mediaType === 'gif' ||
              message.mediaType === 'videoNote') && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/55 text-white">
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </span>
              </span>
            )}

            {/* 글이 없으면 시각을 얹을 자리가 여기뿐이다. */}
            {!message.text && (
              <span className="absolute bottom-1.5 end-1.5 rounded-full bg-slate-900/55 px-1.5 py-0.5 text-[0.7rem] leading-none text-white">
                <EditedMark message={message} muted="" />
                {formatTime(message.date, locale)}
              </span>
            )}
          </div>
        )}

        {/* 사진이 아닌 첨부(파일·위치·투표 등)는 종류만 알린다. 이것도 말풍선 밖이다. */}
        {message.mediaType && !message.mediaKey && (
          <span className="flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
            <Paperclip className="h-3 w-3 shrink-0" />
            {t('messages.media', {
              type: t(`messages.mediaKind.${message.mediaType}`, {
                defaultValue: message.mediaClass ?? message.mediaType,
              }),
            })}
            <MediaInfoButton message={message} className="ms-0.5" />
            {!message.text && (
              <span className="ms-1 text-[0.7rem] text-slate-400">
                <EditedMark message={message} muted="" />
                {formatTime(message.date, locale)}
              </span>
            )}
          </span>
        )}

        {message.text && (
          /*
            시각을 본문 안에 흘려 넣는다.

            `float-end` 로 두면 마지막 줄에 자리가 남을 때는 **그 줄 끝**에 붙고, 모자라면
            아래 줄로 내려가 끝에 선다. 메신저들이 쓰는 그 배치다. `float-right` 가 아니라
            `float-end` 인 이유는 아랍어판 때문이다 — 그쪽은 글이 오른쪽에서 시작하므로
            줄의 끝이 왼쪽이다.
            `flow-root` 는 떠 있는 요소를 문단 높이에 포함시키려고 준다 — 없으면 시각이
            아래 줄로 내려갔을 때 말풍선이 그만큼 안 커져서 글자가 삐져나온다.
          */
          <p
            className={cn(
              'flow-root max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[0.84375rem] sm:max-w-[74%]',
              message.out ? 'bg-primary text-white' : 'bg-slate-100 text-slate-800',
            )}
          >
            {incoming && showSender && message.senderName && (
              <SenderLabel message={message} inBubble />
            )}
            {message.text}
            <span
              className={cn(
                'float-end ms-2 mt-1 select-none text-[0.7rem] leading-none',
                message.out ? 'text-primary-100' : 'text-slate-400',
              )}
            >
              <EditedMark message={message} muted="" />
              {formatTime(message.date, locale)}
            </span>
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * 발신자 이름 한 줄.
 *
 * 말풍선 안과 밖 두 군데에서 쓴다. 같은 것을 두 번 적어 두면 봇 배지 같은 것을 한쪽에만
 * 고치는 일이 생긴다.
 */
function SenderLabel({ message, inBubble = false }: { message: MessageSummary; inBubble?: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        /*
          `w-max` 가 있어야 이름이 온전히 나온다. **두 자리 모두 필요하다.**

          이름이 선 자리의 폭은 옆에 있는 것이 정한다 — 말풍선 안이면 본문 길이가, 밖이면
          스티커나 사진의 크기가 그 폭이다. 그보다 긴 이름은 그 좁은 폭에 갇혀 접히고,
          `break-words` 까지 걸려 있으면 낱말 한가운데서 끊긴다: `김양진 (호` / `주)`.

          max-content 를 주면 그 줄이 자기 폭을 먼저 주장하므로 말풍선이나 열이 이름만큼은
          넓어진다. `max-w-full` 은 아주 긴 이름이 밖으로 삐져나가지 않게 막는 안전장치이고,
          그때는 예전처럼 접힌다.
        */
        'flex w-max max-w-full items-center gap-1 text-xs font-semibold',
        inBubble ? 'mb-0.5 text-primary-700' : 'px-1 text-slate-500',
      )}
    >
      {message.senderName}
      {/* 봇은 이름만으로 구분되지 않는다. 사람 이름을 쓰는 봇도 흔하다. */}
      {message.senderKind !== 'user' && (
        <span className="shrink-0 rounded bg-slate-200 px-1 py-px text-[0.65rem] font-bold uppercase text-slate-600">
          {t(`messages.sender.${message.senderKind}`)}
        </span>
      )}
    </span>
  );
}

/**
 * 날짜가 바뀌는 지점에 끼우는 구분선.
 *
 * 메신저들이 하는 그것이다. 스크롤을 한참 내리다 보면 "지금 보는 게 언제 대화인지"를 놓치는데,
 * 말풍선마다 붙은 시각을 하나하나 읽는 것보다 이쪽이 훨씬 빨리 잡힌다.
 */
export function DateDivider({ unixSeconds }: { unixSeconds: number }) {
  const { i18n } = useTranslation();
  const label = new Date(unixSeconds * 1000).toLocaleDateString(i18n.resolvedLanguage ?? 'ko', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <li className="flex items-center gap-3 py-1" aria-hidden>
      <span className="h-px flex-1 bg-slate-200" />
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
        {label}
      </span>
      <span className="h-px flex-1 bg-slate-200" />
    </li>
  );
}
