import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Info } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { cn } from '@/shared/lib/utils';
import { formatExportTimestamp } from '@/shared/lib/date';
import type { MessageSummary } from '../api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 첨부 파일의 신원을 보여주는 단추.
 *
 * 이 앱은 대화를 **근거로 남기려고** 쓰는 도구다. 그런데 화면에 보이는 그림만으로는 "그때
 * 그 사진이 이 사진인가"를 가릴 수 없다 — 같아 보이는 사진은 얼마든지 만들 수 있다.
 * 텔레그램이 파일마다 붙여 둔 id 는 그 역할을 한다.
 *
 * `i` 를 눌러야 나오게 둔 이유는, 평소에는 대화를 읽는 데 방해가 되기 때문이다.
 */
export function MediaInfoButton({
  message,
  className,
}: {
  message: MessageSummary;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const info = message.mediaInfo;
  if (!info) return null;

  const rows: { label: string; value: string }[] = [
    { label: t('mediaInfo.id'), value: info.id },
    { label: t('mediaInfo.messageId'), value: String(message.id) },
    { label: t('mediaInfo.kind'), value: `${message.mediaType} (${message.mediaClass})` },
    ...(info.fileName ? [{ label: t('mediaInfo.fileName'), value: info.fileName }] : []),
    ...(info.mimeType ? [{ label: t('mediaInfo.mimeType'), value: info.mimeType }] : []),
    ...(info.width && info.height
      ? [{ label: t('mediaInfo.size'), value: `${info.width} × ${info.height}` }]
      : []),
    ...(info.size ? [{ label: t('mediaInfo.bytes'), value: formatBytes(info.size) }] : []),
    ...(info.duration ? [{ label: t('mediaInfo.duration'), value: `${info.duration}s` }] : []),
    ...(info.date ? [{ label: t('mediaInfo.uploaded'), value: formatExportTimestamp(info.date) }] : []),
    ...(info.dcId ? [{ label: t('mediaInfo.dc'), value: String(info.dcId) }] : []),
    ...(info.accessHash ? [{ label: t('mediaInfo.accessHash'), value: info.accessHash }] : []),
  ];

  const copy = async () => {
    // 손으로 옮겨 적을 값이 아니다. 클립보드가 없거나 막힌 환경도 있어 실패는 조용히 넘긴다.
    try {
      await navigator.clipboard.writeText(rows.map((row) => `${row.label}: ${row.value}`).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드를 못 쓰면 화면의 값을 직접 선택하면 된다. */
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={t('mediaInfo.title')}
        onClick={(event) => {
          // 사진 확대가 같이 열리면 안 된다.
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          /*
            평소에는 **거의 안 보이게** 둔다. 대화를 읽는 게 먼저고, 파일 신원은 따져볼 일이
            생겼을 때만 찾는 정보다. 그렇다고 없애면 있는 줄도 모르므로 흐릿하게 남긴다.
          */
          'flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/30 text-white/70',
          'opacity-50 transition hover:bg-slate-900/70 hover:text-white hover:opacity-100',
          'focus-visible:opacity-100',
          className,
        )}
      >
        <Info className="h-3 w-3" />
      </button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={t('mediaInfo.title')}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => void copy()}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {t('mediaInfo.copy')}
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                {t('sessionNotice.confirm')}
              </Button>
            </>
          }
        >
          <dl className="space-y-1.5">
            {rows.map((row) => (
              <div key={row.label} className="flex gap-2">
                <dt className="w-24 shrink-0 text-xs text-slate-500">{row.label}</dt>
                {/* 값은 골라서 복사할 수 있어야 한다. 줄바꿈을 허용해 긴 id 도 다 보이게 둔다. */}
                <dd className="min-w-0 flex-1 select-all break-all font-mono text-xs text-slate-900">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </>
  );
}
