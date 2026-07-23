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
  return <span className={cn('mr-1', muted)}>{t('messages.edited')}</span>;
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
    return (
      <li className="py-1 text-center text-[0.7rem] text-slate-400">
        {t('messages.action', { type: message.actionType })}
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
        {incoming && showSender && message.senderName && (
          <span className="flex items-center gap-1 px-1 text-[0.7rem] font-semibold text-slate-500">
            {message.senderName}
            {/* 봇은 이름만으로 구분되지 않는다. 사람 이름을 쓰는 봇도 흔하다. */}
            {message.senderKind !== 'user' && (
              <span className="rounded bg-slate-200 px-1 py-px text-[0.6rem] font-bold uppercase text-slate-600">
                {t(`messages.sender.${message.senderKind}`)}
              </span>
            )}
          </span>
        )}

        {/*
          **미디어는 말풍선 밖에 둔다.** 사진·스티커·영상은 그 자체로 덩어리라, 색칠한 상자에
          담으면 둘레에 띠가 생겨 액자처럼 보인다. 글이 함께 있으면 글만 말풍선에 담고
          미디어는 그 위에 따로 세운다.
        */}
        {message.mediaKey && (
          <div className="relative">
            <MessagePhoto message={message} dark={message.out} />
            <MediaInfoButton message={message} className="absolute right-1.5 top-1.5" />

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
              <span className="absolute bottom-1.5 right-1.5 rounded-full bg-slate-900/55 px-1.5 py-0.5 text-[0.65rem] leading-none text-white">
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
            <MediaInfoButton message={message} className="ml-0.5" />
            {!message.text && (
              <span className="ml-1 text-[0.65rem] text-slate-400">
                <EditedMark message={message} muted="" />
                {formatTime(message.date, locale)}
              </span>
            )}
          </span>
        )}

        {message.text && (
          /*
            시각을 본문 안에 흘려 넣는다.

            `float-right` 로 두면 마지막 줄에 자리가 남을 때는 **그 줄 오른쪽 끝**에 붙고,
            모자라면 아래 줄로 내려가 오른쪽에 선다. 메신저들이 쓰는 그 배치다.
            `flow-root` 는 떠 있는 요소를 문단 높이에 포함시키려고 준다 — 없으면 시각이
            아래 줄로 내려갔을 때 말풍선이 그만큼 안 커져서 글자가 삐져나온다.
          */
          <p
            className={cn(
              'flow-root max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
              message.out ? 'bg-primary text-white' : 'bg-slate-100 text-slate-800',
            )}
          >
            {message.text}
            <span
              className={cn(
                'float-right ml-2 mt-1 select-none text-[0.65rem] leading-none',
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
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.7rem] font-semibold text-slate-500">
        {label}
      </span>
      <span className="h-px flex-1 bg-slate-200" />
    </li>
  );
}
