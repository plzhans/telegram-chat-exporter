import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, Hourglass, FolderArchive, Search, X, Check } from 'lucide-react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { ErrorNotice } from '@/shared/ui/ErrorNotice';
import { Field } from '@/shared/ui/Field';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';
import { dateKeyOf, shiftDateKey, shiftDateKeyByMonths, todayKey } from '@/shared/lib/date';
import { useCountdown, useDuration } from '@/shared/lib/duration';
import { useAuth } from '@/shared/auth/useAuth';
import { useDialogsQuery, type DialogSummary } from '@/features/dialogs/api';
import { batchExport, type BatchProgress } from '../lib/batchExport';
import type { SplitMode } from '../lib/exportChat';

function normalize(value: string): string {
  return value.normalize('NFC').toLowerCase();
}

/** 단일 내보내기(ExportPanel)와 같은 표기. 현재 방 진행에 그대로 쓴다. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Phase = 'idle' | 'running' | 'done';

/**
 * 여러 대화방을 한 번에 백업하는 화면.
 *
 * 헤비한 작업이라 평소 목록과 떼어 **전용 페이지**로 둔다 — 조건을 한 벌 정하고, 적용할 방을
 * 골라, 방마다 개별 zip 으로 내보낸다(합치지 않는다). 저장은 폴더 스트리밍(크롬) 또는 순차
 * 다운로드(그 외)로 갈린다 — batchExport 참고.
 */
export default function BatchExportPage() {
  const { t } = useTranslation();
  const { data, isPending, error } = useDialogsQuery();
  const me = useAuth((s) => s.me);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 조건 — 선택한 방 전체에 똑같이 적용된다. 개별 내보내기와 같게 **기본은 최근 7일 범위가
  // 보이는 상태**(전체 기간 꺼짐)다. 기본값은 되돌리기 쉬운 좁은 쪽이어야 한다 — 무심코 누른
  // 한 번이 방 여러 개의 전체 기간이 되면 몇 시간짜리 작업이 된다.
  const [wholeHistory, setWholeHistory] = useState(false);
  const [from, setFrom] = useState(() => shiftDateKey(todayKey(), -7));
  const [to, setTo] = useState(() => todayKey());
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeStickers, setIncludeStickers] = useState(true);
  const [layout, setLayout] = useState<'chat' | 'flat'>('chat');
  const [anonymize, setAnonymize] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitMode>('count');

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  /** 내보내는 중엔 새로고침·닫기 전에 한 번 되묻는다(진행분이 날아가지 않게). */
  useEffect(() => {
    if (phase !== 'running') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = normalize(query.trim());
    if (!needle) return data;
    return data.filter((d) => normalize(d.title).includes(needle));
  }, [data, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // 지금 검색에 걸린 것들이 전부 선택됐는지 — 전체 선택/해제 버튼이 무엇을 할지 정한다.
  const visibleIds = filtered.map((d) => d.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });

  const selectedDialogs = useMemo(
    () => (data ?? []).filter((d) => selected.has(d.id)),
    [data, selected],
  );

  const run = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('running');
    setRunError(null);
    setProgress(null);
    try {
      const outcome = await batchExport({
        dialogs: selectedDialogs,
        options: {
          account: me ? { id: me.id, name: me.name } : undefined,
          range: wholeHistory ? {} : { from: from || undefined, to: to || undefined },
          include: { photos: includePhotos, stickers: includeStickers },
          layout,
          anonymize,
          split: splitMode,
        },
        onProgress: setProgress,
        signal: controller.signal,
      });
      // 폴더 선택을 닫았으면 아무것도 안 하고 조용히 되돌린다.
      if (outcome.status === 'cancelled') {
        setPhase('idle');
        return;
      }
      setPhase('done');
    } catch (err) {
      if (err instanceof Error && err.message === 'EXPORT_CANCELLED') {
        setPhase('done'); // 중단이라도 지금까지 받은 결과는 보여준다.
        return;
      }
      setRunError((err as { code?: string })?.code ?? 'UNKNOWN');
      setPhase('idle');
    } finally {
      abortRef.current = null;
    }
  }, [
    selectedDialogs,
    me,
    wholeHistory,
    from,
    to,
    includePhotos,
    includeStickers,
    layout,
    anonymize,
    splitMode,
  ]);

  const applyPreset = (shift: { days: number } | { months: number }) => {
    const end = todayKey();
    setWholeHistory(false);
    setFrom('months' in shift ? shiftDateKeyByMonths(end, -shift.months) : shiftDateKey(end, -shift.days));
    setTo(end);
  };

  const running = phase === 'running';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <FolderArchive className="h-5 w-5 text-slate-400" />
          {t('batch.title')}
        </h1>
        <p className="mt-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          {t('batch.description')}
        </p>
      </div>

      <ErrorNotice error={error} />
      {runError && <Alert tone="warning">{t('batch.runError')}</Alert>}

      {phase === 'done' && progress ? (
        <BatchDone progress={progress} onAgain={() => setPhase('idle')} t={t} />
      ) : running && progress ? (
        <BatchRunning
          progress={progress}
          onCancel={() => abortRef.current?.abort()}
          t={t}
        />
      ) : (
        <>
          {/* ① 조건 */}
          <section className="space-y-3 edge-card bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">{t('batch.optionsTitle')}</h2>

            {!wholeHistory && (
              <Field label={t('export.range')} htmlFor="batch-from" hint={t('export.rangeHint')}>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500">{t('export.presets')}</span>
                  {(
                    [
                      ['export.presetToday', { days: 0 }],
                      ['export.presetWeek', { days: 6 }],
                      ['export.presetMonth', { months: 1 }],
                      ['export.presetYear', { months: 12 }],
                    ] as [string, { days: number } | { months: number }][]
                  ).map(([label, shift]) => (
                    <button
                      key={label}
                      type="button"
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary"
                      onClick={() => applyPreset(shift)}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="batch-from"
                    type="date"
                    aria-label={t('export.from')}
                    className="min-w-0 flex-1"
                    value={from}
                    max={to}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  <span aria-hidden className="shrink-0 text-sm text-slate-400">
                    ~
                  </span>
                  <Input
                    id="batch-to"
                    type="date"
                    aria-label={t('export.to')}
                    className="min-w-0 flex-1"
                    value={to}
                    min={from}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </Field>
            )}

            <Checkbox
              checked={wholeHistory}
              onChange={(e) => setWholeHistory(e.target.checked)}
              label={t('export.wholeHistory')}
              hint={t('export.wholeHistoryHint')}
            />

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-900">{t('export.includeTitle')}</p>
              <div className="mt-1.5 space-y-2">
                <Checkbox
                  checked={includePhotos}
                  onChange={(e) => setIncludePhotos(e.target.checked)}
                  label={t('export.includePhotos')}
                  hint={t('export.includePhotosHint')}
                />
                <Checkbox
                  checked={includeStickers}
                  onChange={(e) => setIncludeStickers(e.target.checked)}
                  label={t('export.includeStickers')}
                  hint={t('export.includeStickersHint')}
                />
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <label htmlFor="batch-split" className="text-xs font-semibold text-slate-900">
                {t('export.splitTitle')}
              </label>
              <select
                id="batch-split"
                value={splitMode}
                onChange={(e) => setSplitMode(e.target.value as SplitMode)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <option value="count">{t('export.splitCount')}</option>
                <option value="none">{t('export.splitNone')}</option>
                <option value="year">{t('export.splitYear')}</option>
                <option value="month">{t('export.splitMonth')}</option>
                <option value="day">{t('export.splitDay')}</option>
              </select>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-900">{t('export.layoutTitle')}</p>
              <div className="mt-1.5 space-y-1">
                {(
                  [
                    ['chat', 'export.layoutChat'],
                    ['flat', 'export.layoutFlat'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="radio"
                      name="batch-layout"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={layout === value}
                      onChange={() => setLayout(value)}
                    />
                    <span className="text-slate-700">{t(label)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <Checkbox
                checked={anonymize}
                onChange={(e) => setAnonymize(e.target.checked)}
                label={t('export.anonymize')}
                hint={t('export.anonymizeHint')}
              />
            </div>
          </section>

          {/* ② 방 선택 */}
          <section className="space-y-3 edge-card bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-900">{t('batch.selectTitle')}</h2>
              {filtered.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  className="shrink-0 text-xs font-semibold text-primary hover:underline"
                >
                  {t(allVisibleSelected ? 'batch.clearVisible' : 'batch.selectVisible')}
                </button>
              )}
            </div>

            {data && data.length > 0 && (
              <div className="relative">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('dialogs.searchPlaceholder')}
                  className="ps-10 pe-10"
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={t('dialogs.searchClear')}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {isPending ? (
              <p className="p-4 text-center text-sm text-slate-500">{t('dialogs.subtitle')}</p>
            ) : filtered.length > 0 ? (
              <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
                {filtered.map((d) => (
                  <RoomItem key={d.id} dialog={d} checked={selected.has(d.id)} onToggle={toggle} />
                ))}
              </ul>
            ) : (
              <p className="p-4 text-center text-sm text-slate-500">
                {t(query ? 'dialogs.noMatch' : 'dialogs.empty')}
              </p>
            )}
          </section>

          <div className="sticky bottom-0 space-y-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
            <p className="text-center text-xs text-slate-500">
              {t('batch.selectedCount', { count: selected.size })}
            </p>
            <Button
              size="lg"
              className="w-full"
              disabled={selected.size === 0}
              onClick={() => setConfirm(true)}
            >
              <FolderArchive className="h-4 w-4" />
              {t('batch.start', { count: selected.size })}
            </Button>
          </div>
        </>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('batch.confirmTitle')}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirm(false);
                void run();
              }}
            >
              {t('batch.confirmOk')}
            </Button>
          </>
        }
      >
        {t('batch.confirmBody', { count: selected.size })}
      </Modal>
    </div>
  );
}

/** 방 목록 한 줄 — 체크박스로 고른다(대화 보기로 넘어가지 않는다). */
function RoomItem({
  dialog,
  checked,
  onToggle,
}: {
  dialog: DialogSummary;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-primary"
          checked={checked}
          onChange={() => onToggle(dialog.id)}
        />
        <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{dialog.title}</span>
      </label>
    </li>
  );
}

function BatchRunning({
  progress,
  onCancel,
  t,
}: {
  progress: BatchProgress;
  onCancel: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const inner = progress.current;
  // 현재 방이 요청 제한으로 대기 중이면 끝나는 시각에서 남은 초를 센다(단일 내보내기와 같은 훅).
  const remainSeconds = useCountdown(inner?.floodWaitUntil);
  const formatDuration = useDuration();

  const overall = progress.total > 0 ? progress.completed / progress.total : 0;

  // 현재 방 내부 진행 — 단계(메시지/첨부)에 따라 세는 대상이 다르다. 개별 내보내기와 같은 규칙.
  const files = inner?.phase === 'files';
  const at = files ? inner?.files ?? 0 : inner?.count ?? 0;
  const total = files ? inner?.totalFiles : inner?.totalCount;
  const known = typeof total === 'number' && total > 0;
  const ratio = known ? Math.min(at / total, 1) : 0;

  return (
    <section className="space-y-3 edge-card bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">
            {t('batch.progress', {
              index: Math.min(progress.currentIndex + 1, progress.total),
              total: progress.total,
            })}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{progress.currentTitle}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {t('export.cancel')}
        </Button>
      </div>

      {/* 전체 진행(방 단위) — 몇 번째 방까지 끝났나. */}
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${overall * 100}%` }}
        />
      </div>

      {/*
        **현재 방의 상세 진행.** 방 하나가 통째로 도는 게 아니라, 개별 내보내기와 같은 양식으로
        메시지·첨부를 단계별로 보여준다 — 몇 건 중 몇 건, 몇 %, 담은 용량, 어디쯤 날짜까지.
      */}
      {inner && (
        <div className="space-y-1.5 rounded-xl bg-slate-50 p-3">
          <p className="flex items-baseline gap-2 text-xs font-semibold text-primary">
            <span>
              {known
                ? files
                  ? t('export.progressFiles', { files: at, totalFiles: total })
                  : t('export.progress', { count: at, total })
                : t('export.progressCounting', { count: at })}
            </span>
            {known && <span className="tabular-nums">{Math.floor(ratio * 100)}%</span>}
            <span className="ms-auto font-normal text-slate-500">
              {formatBytes(inner.bytes)}
              {!files && inner.lastDate && ` · ~${dateKeyOf(inner.lastDate)}`}
            </span>
          </p>
          {known && (
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* 요청 제한 대기 — 멈춘 게 아님을 알린다(단일 내보내기와 같은 안내). */}
      {remainSeconds !== null && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-amber-600" />
          <p className="text-xs font-medium leading-relaxed text-amber-800">
            {t('export.waitingFor', { remain: formatDuration(remainSeconds) })}
          </p>
        </div>
      )}

      {/* 고른 폴더 이름 — 어디에 담기는지 보여준다(전체 경로는 브라우저가 안 준다). */}
      {progress.folderName && (
        <div className="flex items-center gap-2.5 rounded-xl border border-primary-100 bg-primary-50 p-3">
          <Folder className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">{t('batch.savedTo')}</p>
            <p className="min-w-0 truncate font-mono text-base font-bold text-slate-900">
              {progress.folderName}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">{t('batch.saveHint_' + progress.saveMode)}</p>
    </section>
  );
}

function BatchDone({
  progress,
  onAgain,
  t,
}: {
  progress: BatchProgress;
  onAgain: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const ok = progress.results.filter((r) => r.status === 'ok').length;
  const failed = progress.results.filter((r) => r.status === 'failed').length;

  return (
    <section className="space-y-3 edge-card bg-white p-4">
      <Alert tone="trust" title={t('batch.doneTitle')}>
        {t('batch.doneSummary', { ok, failed })}
      </Alert>

      {/* 어느 폴더에 담겼는지. 순차 다운로드였으면 폴더가 없으니 안 나온다. */}
      {progress.folderName && (
        <div className="flex items-center gap-2.5 rounded-xl border border-primary-100 bg-primary-50 p-3">
          <Folder className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">{t('batch.savedTo')}</p>
            <p className="min-w-0 truncate font-mono text-base font-bold text-slate-900">
              {progress.folderName}
            </p>
          </div>
        </div>
      )}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 text-xs">
        {progress.results.map((r) => (
          <li key={r.dialogId} className="flex items-center gap-2 px-3 py-2">
            {r.status === 'ok' ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 text-red-500" />
            )}
            <span className="min-w-0 flex-1 truncate text-slate-700">{r.title}</span>
            <span className="shrink-0 tabular-nums text-slate-400">
              {r.status === 'ok' ? t('export.doneCount', { count: r.messageCount ?? 0 }) : r.error}
            </span>
          </li>
        ))}
      </ul>

      <Button variant="secondary" size="sm" onClick={onAgain}>
        {t('export.again')}
      </Button>
    </section>
  );
}
