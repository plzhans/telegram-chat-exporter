import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import type { MessageSummary } from '../api';
import { Avatar } from './Avatar';
import { MediaInfoButton } from './MediaInfoButton';
import { MessagePhoto } from './MessagePhoto';

/** 말풍선 옆에는 시각만. MessageRow 와 같은 규칙이다. */
function formatTime(unixSeconds: number, locale: string): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    // 한국어 로케일은 기본이 오전/오후라 명시해야 24시간제가 된다.
    hour12: false,
  });
}

interface MessageAlbumProps {
  /** 같은 `groupedId` 를 가진 메시지들. 올린 사람이 한 번에 보낸 묶음이다. */
  messages: MessageSummary[];
  showSender?: boolean;
}

/**
 * 사진 여러 장을 한 덩어리로 그린다.
 *
 * 텔레그램은 한 번에 올린 사진들을 **각각의 메시지로 저장하면서 같은 `groupedId`** 를 단다.
 * 그대로 풀어 놓으면 사진 한 장짜리 말풍선이 줄줄이 늘어서서, 올린 사람이 의도한 "한 번에
 * 보낸 묶음"이라는 사실이 사라진다.
 *
 * 격자는 **두 칸**이다. 텔레그램도 그렇고, 대화 폭에서 세 칸으로 나누면 사진이 너무 작아
 * 무엇인지 알아볼 수 없다. 홀수 장이면 마지막 한 장이 두 칸을 차지한다.
 */
export function MessageAlbum({ messages, showSender = true }: MessageAlbumProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'ko';

  const first = messages[0];
  const incoming = !first.out;
  /** 캡션은 묶음 전체에 하나뿐이다. 어느 장에 붙어 있을지는 정해져 있지 않다. */
  const caption = messages.find((message) => message.text)?.text;

  /**
   * 두 장씩 한 줄로 끊는다. 마지막 줄은 한 장일 수 있다.
   *
   * **줄마다 높이를 하나로 두고 가로를 사진 비율대로 나눈다.** 그러면 칸의 비율이 사진
   * 비율과 정확히 같아져서 **잘리지도, 빈 자리가 남지도 않는다.**
   *
   * 앞서 두 가지를 거쳤다. 정사각형 칸 + `cover` 는 세로 사진의 위아래를 잘라먹었고,
   * 평균 비율 칸 + `contain` 은 사진마다 남는 여백이 생겨 사이가 벌어져 보였다. 둘 다
   * "칸 크기를 먼저 정하고 사진을 맞춘" 탓이다. 반대로 사진이 칸을 정하게 하면 둘 다 없다.
   *
   * 계산은 간단하다. 폭 W 를 두 장이 나눠 갖고 높이 h 가 같다면
   * `W = h·r₁ + h·r₂` 이므로 `h = W / (r₁+r₂)`, 즉 **줄의 가로세로비가 곧 비율의 합**이다.
   */
  const ratioOf = (message: MessageSummary) =>
    message.mediaWidth && message.mediaHeight ? message.mediaWidth / message.mediaHeight : 1;

  /** 확대 보기에서 좌우로 넘길 대상. 이 묶음의 사진 전부다. */
  const albumKeys = messages
    .map((message) => message.mediaKey)
    .filter((key): key is string => Boolean(key));

  const rows: MessageSummary[][] = [];
  for (let index = 0; index < messages.length; index += 2) {
    rows.push(messages.slice(index, index + 2));
  }

  return (
    <li className={cn('flex items-end gap-2', first.out && 'flex-row-reverse')}>
      {incoming &&
        (showSender ? (
          <Avatar
            id={first.senderId ?? String(first.id)}
            title={first.senderName ?? ''}
            kind="user"
            photo={first.senderPhoto}
            sharp
            className="h-7 w-7 text-[0.7rem]"
          />
        ) : (
          <span className="h-7 w-7 shrink-0" />
        ))}

      {/* `flex-1` 인 이유는 MessageRow 와 같다 - 없으면 아래 `max-w-[80%]` 가 앨범 자기
          너비의 80%(256 → 205px)가 되어 격자가 이유 없이 쪼그라든다. */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-0.5',
          first.out ? 'items-end' : 'items-start',
        )}
      >
        {incoming && showSender && first.senderName && (
          <span className="px-1 text-[0.7rem] font-semibold text-slate-500">{first.senderName}</span>
        )}

        <div
          className={cn(
            'relative max-w-[80%] overflow-hidden rounded-2xl',
            caption && (first.out ? 'bg-primary text-white' : 'bg-slate-100 text-slate-800'),
          )}
          style={{ width: 256, maxWidth: '100%' }}
        >
          {/* 사진끼리 딱 붙인다. 틈을 주면 격자가 아니라 흩어진 사진들로 보인다. */}
          <div className="flex flex-col">
            {rows.map((row) => {
              const total = row.reduce((sum, message) => sum + ratioOf(message), 0);
              return (
                <div key={row[0].id} className="flex" style={{ aspectRatio: total }}>
                  {row.map((message) => (
                    // flex 비율이 곧 사진 비율이라, 칸과 사진의 모양이 정확히 일치한다.
                    <div key={message.id} className="relative" style={{ flex: ratioOf(message) }}>
                      <MessagePhoto message={message} dark={first.out} tile albumKeys={albumKeys} />
                      <MediaInfoButton message={message} className="absolute end-1 top-1" />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {caption ? (
            <p className="flow-root whitespace-pre-wrap break-words px-3 py-2 text-sm">
              {caption}
              <span
                className={cn(
                  'float-end ms-2 mt-1 select-none text-[0.65rem] leading-none',
                  first.out ? 'text-primary-100' : 'text-slate-400',
                )}
              >
                {formatTime(first.date, locale)}
              </span>
            </p>
          ) : (
            <span className="absolute bottom-1.5 end-1.5 rounded-full bg-slate-900/55 px-1.5 py-0.5 text-[0.65rem] leading-none text-white">
              {formatTime(first.date, locale)}
            </span>
          )}

          {/* 테두리는 묶음 바깥에 한 번만 두른다. */}
          <span
            className="pointer-events-none absolute inset-0 rounded-[inherit] border border-slate-900/15"
            aria-hidden
          />
        </div>

        {/* 사진 수를 적어 둔다. 잘려 보이는 장이 있어도 몇 장짜리인지 알 수 있다. */}
        <span className="px-1 text-[0.65rem] text-slate-400">
          {t('messages.albumCount', { count: messages.length })}
        </span>
      </div>
    </li>
  );
}
