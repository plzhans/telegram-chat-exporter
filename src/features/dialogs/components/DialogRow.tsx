import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { dateKeyOf, toDateKey } from '@/shared/lib/date';
import type { DialogPreview, DialogSummary } from '../api';
import { Avatar } from './Avatar';

/**
 * 목록용 짧은 시각 표기.
 *
 * 오늘 온 대화는 시각(`14:23`), 그 전은 날짜(`07.11`), 해가 바뀌었으면 연도까지(`2025.12.30`).
 * 메신저들이 쓰는 방식이고, 훑어볼 때 필요한 만큼만 보여준다.
 */
function formatDialogTime(unixSeconds: number, locale: string): string {
  const date = new Date(unixSeconds * 1000);
  const now = new Date();
  if (dateKeyOf(unixSeconds) === toDateKey(now)) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const key = dateKeyOf(unixSeconds);
  return date.getFullYear() === now.getFullYear() ? key.slice(5).replace('-', '.') : key.replace(/-/g, '.');
}

type T = (key: string, opts?: Record<string, unknown>) => string;

/** 미디어 종류 이름. 모르는 종류는 뭉뚱그린다 — 목록에서 정확한 분류가 값어치 있지 않다. */
function mediaLabel(preview: DialogPreview, t: T): string {
  const known = ['photo', 'document', 'video', 'audio', 'sticker', 'poll', 'contact', 'geo', 'webPage', 'action'];
  const key = preview.mediaKind && known.includes(preview.mediaKind) ? preview.mediaKind : 'other';
  return t(`dialogs.preview.${key}`);
}

/** "나: " 또는 "홍길동: ". 1:1 상대의 말에는 아무것도 안 붙인다. */
function prefixOf(preview: DialogPreview, t: T): string {
  if (preview.out) return `${t('dialogs.preview.you')}: `;
  return preview.senderName ? `${preview.senderName}: ` : '';
}

export function DialogRow({ dialog }: { dialog: DialogSummary }) {
  const { t, i18n } = useTranslation();

  return (
    <li>
      <Link
        to={`/dialogs/${dialog.id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
      >
        <Avatar
          id={dialog.id}
          title={dialog.title}
          kind={dialog.kind}
          photo={dialog.photo}
          // 목록은 스크롤하며 훑는 곳이라 선명한 사진이 값어치를 한다. 보이는 것만 받는다.
          sharp
          className="h-9 w-9 text-sm"
        />

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
              {dialog.title}
            </span>
            {/*
              마지막 대화 시각. **대화방 목록 응답에 이미 들어 있는 값**이라 요청이 늘지 않는다.
              오늘이면 시각만, 그 전이면 날짜만 — 목록에서 훑을 때는 그 정도면 충분하고
              둘 다 적으면 이름 자리를 잡아먹는다.
            */}
            <span className="shrink-0 text-[0.7rem] tabular-nums text-slate-400">
              {formatDialogTime(dialog.date, i18n.resolvedLanguage ?? 'ko')}
            </span>
          </span>
          {/*
            마지막 메시지. 이것도 목록 응답에 이미 들어 있어 요청이 늘지 않는다
            (features/dialogs/api.ts 의 toPreview 주석 참고).
          */}
          {dialog.preview ? (
            <span className="block truncate text-xs text-slate-500">
              {prefixOf(dialog.preview, t)}
              {dialog.preview.text ? (
                dialog.preview.text
              ) : (
                <span className="text-slate-400">{mediaLabel(dialog.preview, t)}</span>
              )}
            </span>
          ) : (
            <span className="block text-xs text-slate-500">{t(`dialogs.type.${dialog.kind}`)}</span>
          )}
        </span>

        {dialog.unreadCount > 0 && (
          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
            {/* 안 읽음이 수천 건인 채널도 흔하다. 번역 문자열을 안 거치므로 여기서 직접 찍는다. */}
            {dialog.unreadCount.toLocaleString(i18n.resolvedLanguage)}
          </span>
        )}

        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
      </Link>
    </li>
  );
}
