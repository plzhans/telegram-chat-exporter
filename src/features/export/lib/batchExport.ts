import { getCachedPeer, type DialogSummary } from '@/features/dialogs/api';
import { describeError } from '@/shared/telegram/errors';
import {
  exportChat,
  exportFilename,
  type ExportOptions,
  type ExportProgress,
  type ExportRange,
  type SplitMode,
} from './exportChat';
import { createDirFileSink, createMemorySink, pickDirectory } from './zipWriter';

/**
 * 여러 대화방을 **한 번에** 백업한다 — 단, 방마다 **개별 zip**으로.
 *
 * ## 왜 방별 개별 파일인가
 *
 * 한 파일에 다 합치면 첨부 때문에 수 GB 로 부풀고, 방 하나 보겠다고 그 전체를 풀어야 한다.
 * 그래서 방마다 따로 담는다 — 지금 단일 내보내기가 만드는 zip 이 방 수만큼 나오는 셈이다.
 *
 * ## 저장
 *
 * - **폴더 스트리밍**(크롬·엣지): `showDirectoryPicker` 로 폴더를 한 번 고르면, 방마다 그 안에
 *   zip 을 디스크로 흘려보낸다. 총량이 커도 메모리에 안 쌓인다.
 * - **순차 다운로드**(파폭·사파리): 방마다 메모리로 만들어 하나씩 내려받고 비운다. 한 번에 한
 *   방만 메모리에 뜨므로 부담은 방 하나 크기다("여러 다운로드 허용?" 을 브라우저가 한 번 묻는다).
 *
 * ## 실패는 계속
 *
 * 한 방이 요청 제한·오류로 죽어도 **거기서 멈추지 않는다.** 그 방을 실패로 적고 다음 방으로
 * 넘어간다 — 열 개 받다 세 번째에서 막혀 나머지 일곱을 못 받는 게 제일 나쁘다.
 */

/** 전체 방에 똑같이 적용되는 내보내기 조건. 단일 내보내기 옵션에서 방·저장 관련만 뺀 것이다. */
export interface BatchOptions {
  account?: { id: string; name: string };
  range: ExportRange;
  include?: { photos?: boolean; stickers?: boolean };
  layout?: 'chat' | 'flat';
  anonymize?: boolean;
  split?: SplitMode;
}

export interface BatchItemResult {
  dialogId: string;
  title: string;
  filename: string;
  status: 'ok' | 'failed';
  /** 성공했으면 담은 메시지 수(마지막 진행 보고 기준). */
  messageCount?: number;
  /** 실패 사유 코드. */
  error?: string;
}

export interface BatchProgress {
  /** 저장 방식. picked=폴더 스트리밍, download=순차 다운로드. */
  saveMode: 'picked' | 'download';
  /**
   * 사용자가 고른 폴더 이름. `picked` 일 때만 있다.
   *
   * **전체 경로가 아니라 이름뿐이다** — File System Access API 는 보안상 폴더의 전체 경로를
   * 알려주지 않는다(단일 내보내기 파일명과 같은 사정). 그래도 "어디에 담기는지"를 알려주는
   * 데는 이름이면 충분하다.
   */
  folderName?: string;
  /** 전체 방 수. */
  total: number;
  /** 끝난 방 수(성공+실패). */
  completed: number;
  /** 지금 처리 중인 방의 순번(0부터). */
  currentIndex: number;
  /** 지금 처리 중인 방 제목. */
  currentTitle?: string;
  /** 지금 방의 **내부** 진행(단일 내보내기와 같은 값). 방이 바뀌면 초기화된다. */
  current?: ExportProgress;
  /** 지금까지의 방별 결과. */
  results: BatchItemResult[];
}

export type BatchOutcome =
  | { status: 'cancelled' } // 폴더 선택을 닫았다 — 아무것도 시작하지 않았다.
  | { status: 'done'; saveMode: 'picked' | 'download'; results: BatchItemResult[] };

export interface BatchExportArgs {
  dialogs: DialogSummary[];
  options: BatchOptions;
  onProgress: (progress: BatchProgress) => void;
  signal: AbortSignal;
}

/** 순차 다운로드일 때 방 사이에 두는 간격. 안 두면 브라우저가 뒤 다운로드를 흘려버린다. */
const DOWNLOAD_GAP_MS = 800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function batchExport({
  dialogs,
  options,
  onProgress,
  signal,
}: BatchExportArgs): Promise<BatchOutcome> {
  /*
    **폴더 선택을 맨 먼저 한다.** `showDirectoryPicker` 는 사용자 제스처를 요구하는데, 이 함수가
    클릭 핸들러에서 곧바로 불리면(첫 await 가 이것이면) 제스처가 살아 있다. 단일 내보내기가
    `createFileSink` 를 제일 먼저 부르는 것과 같은 이유다.
  */
  const picked = await pickDirectory();
  if (picked.status === 'cancelled') return { status: 'cancelled' };
  const saveMode: 'picked' | 'download' = picked.status === 'ok' ? 'picked' : 'download';
  const folderName = picked.status === 'ok' ? picked.dir.name : undefined;

  const results: BatchItemResult[] = [];
  const report = (currentIndex: number, currentTitle?: string, current?: ExportProgress) =>
    onProgress({
      saveMode,
      folderName,
      total: dialogs.length,
      completed: results.length,
      currentIndex,
      currentTitle,
      current,
      results,
    });

  report(0);

  for (let index = 0; index < dialogs.length; index += 1) {
    if (signal.aborted) throw new Error('EXPORT_CANCELLED');
    const dialog = dialogs[index];
    const filename = exportFilename(dialog, options.anonymize);

    const peer = getCachedPeer(dialog.id);
    if (!peer) {
      // 목록에서 고른 방이라 보통 캐시에 있다. 없으면(새로고침 등) 그 방만 실패로 적고 넘어간다.
      results.push({
        dialogId: dialog.id,
        title: dialog.title,
        filename,
        status: 'failed',
        error: 'PEER_NOT_CACHED',
      });
      report(index, dialog.title);
      continue;
    }

    report(index, dialog.title);

    let last: ExportProgress | undefined;
    try {
      const sink =
        saveMode === 'picked' && picked.status === 'ok'
          ? await createDirFileSink(picked.dir, filename)
          : createMemorySink(filename);

      const chatOptions: ExportOptions = {
        dialog,
        account: options.account,
        peer,
        sink,
        range: options.range,
        include: options.include,
        layout: options.layout,
        anonymize: options.anonymize,
        split: options.split,
        signal,
        onProgress: (progress) => {
          last = progress;
          report(index, dialog.title, progress);
        },
      };

      await exportChat(chatOptions);
      results.push({
        dialogId: dialog.id,
        title: dialog.title,
        filename,
        status: 'ok',
        messageCount: last?.count ?? 0,
      });
    } catch (err) {
      // 사용자가 중단했으면 배치 전체를 멈춘다. 그 외 오류는 이 방만 실패로 적고 계속.
      if (signal.aborted || (err instanceof Error && err.message === 'EXPORT_CANCELLED')) {
        throw new Error('EXPORT_CANCELLED');
      }
      results.push({
        dialogId: dialog.id,
        title: dialog.title,
        filename,
        status: 'failed',
        error: describeError(err).code,
      });
    }

    report(index, dialog.title);

    // 순차 다운로드는 방 사이에 숨을 돌려야 브라우저가 다음 파일을 흘려버리지 않는다.
    if (saveMode === 'download' && index < dialogs.length - 1) {
      await delay(DOWNLOAD_GAP_MS);
    }
  }

  return { status: 'done', saveMode, results };
}
