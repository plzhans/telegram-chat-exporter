import type { Api } from 'telegram';
import { requireClient } from '@/shared/auth/useAuth';
import { describeError } from '@/shared/telegram/errors';
import {
  dateKeyOf,
  endOfDayUnix,
  formatExportTimestamp,
  localOffsetMinutes,
  formatFileTimestamp,
  localTimeZone,
  startOfDayUnix,
} from '@/shared/lib/date';
import { toMessageSummary, type DialogSummary, type MessageSummary } from '@/features/dialogs/api';
import type { ZipSink } from './zipWriter';
import { ZipWriter } from './zipWriter';

export interface ExportProgress {
  /** 지금까지 내보낸 메시지 수. */
  count: number;
  /** 지금까지 파일로 쓴 바이트 수(압축 후). */
  bytes: number;
  /** 마지막으로 처리한 메시지의 시각(Unix 초). 어디쯤 왔는지 보여준다. */
  lastDate?: number;
  /**
   * 지금 무슨 일을 하고 있는가.
   *
   * 첨부를 받는 단계는 메시지를 훑는 단계보다 **한참 느리다.** 같은 진행률 표시를 쓰면
   * 사용자는 숫자가 갑자기 안 늘어나는 걸 고장으로 읽는다.
   */
  phase?: 'messages' | 'files';
  /** 지금까지 담은 첨부 파일 수. */
  files?: number;
  /** 담아야 할 첨부 파일 수. 이게 있어야 "몇 개 중 몇 개"가 된다. */
  totalFiles?: number;
}

export interface ExportRange {
  /**
   * 로컬 날짜 `yyyy-mm-dd`. 비우면 처음/끝까지.
   *
   * Date 가 아니라 날짜 키를 받는다. Date 로 주고받으면 "이게 자정인가 하루 끝인가"가
   * 호출부마다 달라지고, 그 경계를 로컬로 잡았는지 UTC 로 잡았는지도 흐려진다.
   * 여기서 `startOfDayUnix`/`endOfDayUnix` 로 한 번에 정한다.
   */
  from?: string;
  to?: string;
}

export interface ExportOptions {
  dialog: DialogSummary;
  /**
   * 이 백업을 받은 계정. 파일 이름에서 뺀 정보라 여기에는 반드시 남긴다 —
   * 여러 계정의 백업이 섞였을 때 어느 계정에서 받은 것인지 구분할 근거가 이것뿐이다.
   */
  account?: { id: string; name: string };
  peer: Api.TypeInputPeer;
  sink: ZipSink;
  range: ExportRange;
  /**
   * 함께 담을 첨부 종류.
   *
   * 지금은 사진 하나뿐이지만 집합으로 받는다 — 동영상·문서가 붙을 자리를 미리 열어 두면
   * 그때 이 함수의 모양을 바꾸지 않아도 된다.
   */
  include?: { photos?: boolean };
  onProgress: (progress: ExportProgress) => void;
  signal: AbortSignal;
}

/**
 * 한 배치에 처리할 메시지 수.
 *
 * zip 압축이 동기라 밀어넣는 동안 UI 가 멈춘다. 배치를 끝낼 때마다 대기열을 비우고
 * 이벤트 루프에 제어를 넘겨서 진행률이 갱신되고 취소 버튼이 눌리게 한다.
 */
const BATCH_SIZE = 200;

/**
 * 내보내는 동안 GramJS 가 알아서 자고 넘어갈 FLOOD_WAIT 상한(초).
 *
 * 평소 값(60초)을 그대로 두면 **오래된 대화방일수록 내보내기가 통째로 죽는다** — 텔레그램은
 * 긴 히스토리를 훑을 때 수백 초짜리 제한을 걸고, 그러면 GramJS 가 자는 대신 예외를 던진다.
 * 한 시간짜리 작업을 90초 대기 때문에 처음부터 다시 하는 건 말이 안 되므로, 내보내기 동안만
 * 크게 올리고 끝나면 되돌린다.
 */
const EXPORT_FLOOD_SLEEP_THRESHOLD = 15 * 60;

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * `messages.jsonl` 한 줄의 모양.
 *
 * **화면용 객체를 그대로 직렬화하지 않는다.** 예전에는 `JSON.stringify(summary)` 였는데,
 * 거기에는 아바타로 쓰는 `senderPhoto`(base64 JPEG data URL)가 들어 있어서 **메시지마다
 * 썸네일이 통째로 박혔다.** 실제로 메시지 13건짜리 내보내기가 8KB 였다 — 24만 건이면
 * 수백 MB 가 중복 데이터로 채워진다.
 *
 * 그래서 내보낼 항목을 여기서 **명시적으로 고른다.** 화면 쪽에 필드가 새로 생겨도 파일
 * 형식이 조용히 따라 바뀌지 않는다는 뜻이기도 하다.
 */
interface ExportRecord {
  id: number;
  /** Unix 초. 시간대와 무관한 원본 값이라 나중에 어떤 기준으로도 다시 해석할 수 있다. */
  date: number;
  out: boolean;
  senderId: string | null;
  senderKind: MessageSummary['senderKind'];
  senderName: string | null;
  text: string;
  mediaType: string | null;
  /** 원래 TL 클래스 이름. 우리가 못 다루는 종류가 와도 무엇이었는지는 남는다. */
  mediaClass: string | null;
  /** 첨부 파일의 신원. 백업을 근거로 쓸 때 "그 파일이 이 파일인가"를 가릴 값이다. */
  mediaInfo: MessageSummary['mediaInfo'] | null;
  actionType: string | null;
  actionClass: string | null;
  /** 나중에 고쳐진 메시지면 그 시각(Unix 초). 원문 그대로면 null. */
  editDate: number | null;
}

function toExportRecord(message: MessageSummary): ExportRecord {
  return {
    id: message.id,
    date: message.date,
    out: message.out,
    senderId: message.senderId ?? null,
    senderKind: message.senderKind,
    senderName: message.senderName ?? null,
    text: message.text,
    mediaType: message.mediaType ?? null,
    mediaClass: message.mediaClass ?? null,
    mediaInfo: message.mediaInfo ?? null,
    actionType: message.actionType ?? null,
    actionClass: message.actionClass ?? null,
    editDate: message.editDate ?? null,
  };
}

/**
 * 사람이 읽는 쪽 파일의 한 줄.
 *
 *     [2026-07-11 12:24:07,토][user:123456789][손원철] 야쿠자를 기다리는 모임
 *     [2026-07-11 12:25:01,토][bot:987654321][알림봇] 예약이 확정되었습니다
 *
 * 앞의 세 칸은 **고정 폭이 아니라 고정 개수**다. 시각·발신자·이름 순서를 지키면
 * `^\[(.+?),(.)\]\[(\w+):(.*?)\]\[(.*?)\] (.*)$` 로 기계가 다시 읽을 수 있다.
 *
 * 이름 대신 id 를 같이 남기는 이유는, 이름은 언제든 바뀌고 중복될 수 있어서다. 나중에
 * "이 사람이 누구였나"를 되짚을 수 있는 건 id 뿐이다.
 *
 * 시각은 로컬 기준이며 어느 시간대인지는 meta.json 이 밝힌다.
 */
function toReadableLine(message: MessageSummary): string {
  const parts = [message.text];
  /*
    종류와 함께 **원래 TL 이름도 남긴다.** 우리가 못 다루는 첨부가 와도 나중에 형태를
    되짚을 수 있어야 한다 — 요약된 이름만 남기면 그 정보가 사라진다.
  */
  if (message.mediaType) {
    /*
      **파일 자체는 아직 받지 않는다.** 대신 나중에 받아서 대조할 수 있을 만큼의 표식을
      남긴다 — 종류·원래 TL 이름·파일 id, 그리고 있으면 파일명과 크기까지.
      id 는 텔레그램이 파일에 붙인 전역 값이라, 훗날 원본을 구했을 때 "이 줄에 적힌 그
      파일이 맞다"를 가릴 근거가 된다.
    */
    const info = message.mediaInfo;
    const marks = [
      message.mediaType,
      message.mediaClass ? `(${message.mediaClass})` : '',
      info ? `id=${info.id}` : '',
      info?.fileName ? `name=${info.fileName}` : '',
      info?.size ? `bytes=${info.size}` : '',
    ].filter(Boolean);
    parts.push(`[attachment: ${marks.join(' ')}]`);
  }
  if (message.actionType) {
    parts.push(`[system: ${message.actionType}${message.actionClass ? ` (${message.actionClass})` : ''}]`);
  }
  // 원문 그대로인지 나중에 고친 것인지는 근거로 쓸 때 다른 사실이다.
  if (message.editDate) parts.push(`[edited: ${formatExportTimestamp(message.editDate)}]`);
  const body = parts.filter(Boolean).join(' ');
  const timestamp = formatExportTimestamp(message.date);
  // 종류를 id 앞에 붙인다. 칸 수를 늘리지 않아야 기존 파일과 같은 규칙으로 파싱된다.
  const sender = `${message.senderKind}:${message.senderId ?? ''}`;
  return `[${timestamp}][${sender}][${message.senderName ?? ''}] ${body}\n`;
}

/**
 * 확장자를 정한다.
 *
 * **텔레그램 사진은 언제나 JPEG 이다.** 서버가 올라온 그림을 자기 형식으로 다시 인코딩하기
 * 때문에, 보낸 사람이 PNG 를 올렸어도 사진(`MessageMediaPhoto`)으로 왔다면 받는 것은 JPEG 다.
 *
 * 파일로 보낸 그림(`MessageMediaDocument`)은 원본 그대로 보관되므로 형식이 제각각이다.
 * 그쪽은 파일명에 붙은 확장자를 먼저 믿고, 없으면 MIME 형식에서 끌어낸다.
 *
 * 둘 다 없으면 **확장자 없이 둔다.** 아무 확장자나 붙이면 열었을 때 깨지고, 그건 잘못된
 * 사실을 파일 이름으로 주장하는 셈이다.
 */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
};

function extensionFor(summary: MessageSummary): string {
  if (summary.mediaType === 'photo') return '.jpg';
  const fromName = /\.[a-z0-9]{1,5}$/i.exec(summary.mediaInfo?.fileName ?? '')?.[0];
  if (fromName) return fromName.toLowerCase();
  return MIME_EXTENSIONS[summary.mediaInfo?.mimeType ?? ''] ?? '';
}

/**
 * 함께 담을 그림인가.
 *
 * 사진과, **파일로 보낸 그림**까지 본다. 후자는 화면에서 `file` 로 분류되지만 사용자에게는
 * 똑같은 사진이다 — 원본 화질을 지키려고 파일로 보내는 경우가 흔하다.
 *
 * **스티커는 뺀다.** 대화의 내용이 아니라 표현이고, 텔레그램 누구에게나 같은 그림이라
 * 근거로서 값이 없다. 개수만 늘어난다.
 */
function isPhoto(summary: MessageSummary): boolean {
  if (summary.mediaType === 'sticker') return false;
  if (summary.mediaType === 'photo') return true;
  return Boolean(summary.mediaInfo?.mimeType?.startsWith('image/'));
}

/**
 * 저장 경로: `files/{yyyy}/{MM}/{dd}/{파일 id}{확장자}`
 *
 * 날짜는 **메시지가 오간 날**이다. 파일이 올라온 날(`mediaInfo.date`)이 아니다 — 전달된
 * 사진은 그 둘이 몇 년씩 벌어지고, 사람이 찾을 때 기준으로 삼는 건 대화가 오간 날이다.
 *
 * 이름을 파일 id 로 두는 이유는 그것만이 안 바뀌는 값이어서다. 원래 파일명은 겹치고
 * (`IMG_0001.jpg`), 없을 때도 많고, 글자가 깨지기도 한다. 원래 이름은 목록에 남는다.
 */
function filePathFor(summary: MessageSummary): string | undefined {
  const id = summary.mediaInfo?.id;
  if (!id) return undefined;
  const [year, month, day] = dateKeyOf(summary.date).split('-');
  return `files/${year}/${month}/${day}/${id}${extensionFor(summary)}`;
}

/**
 * 받은 바이트의 SHA-256.
 *
 * 근거로 쓸 때 "이 파일이 그때 그 파일인가"를 가릴 값이다. 파일 id 는 텔레그램이 붙인
 * 이름표라 내용이 바뀌어도 그대로지만, 이 값은 **내용 자체에서 나온다.** 목록에 적어 두면
 * 나중에 누구든 같은 계산을 해서 대조할 수 있다.
 *
 * `crypto.subtle` 은 보안 컨텍스트(https·localhost)에서만 있다. 없으면 해시 없이 간다 —
 * 파일을 못 담는 것보다는 낫다.
 */
async function sha256(bytes: Uint8Array): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

/**
 * 한 번에 몇 개를 동시에 받을까.
 *
 * 하나씩 받으면 사진 수백 장에 몇십 분이 걸린다. 반대로 많이 벌리면 텔레그램이 제한을
 * 건다. 셋은 그 사이에서 고른 값이다. 받는 건 동시에 하되 **zip 에 넣는 순서는 지킨다** —
 * 그래야 메모리에 떠 있는 파일이 항상 이 개수를 넘지 않는다.
 */
const FILE_CONCURRENCY = 3;

/** 두 번째 단계에서 받을 대상. 메시지 전체가 아니라 필요한 것만 들고 있는다. */
interface PhotoTask {
  messageId: number;
  path: string;
  /**
   * `downloadMedia` 에 그대로 넘길 값.
   *
   * 메시지 객체째로 들고 있지 않는 이유는 메모리다. 사진이 수만 장인 대화방이면 그 차이가
   * 커진다. 미디어 조각만 있으면 받는 데 충분하다.
   */
  media: Api.TypeMessageMedia;
}

/**
 * 파일명에 쓸 수 없는 문자를 걷어낸다.
 *
 * 대화방 제목에는 `/`, `:`, 이모지, 개행까지 뭐든 들어온다. 그대로 파일명에 쓰면 OS 마다
 * 다르게 깨지므로 보수적으로 자른다. 원본 제목은 meta.json 에 그대로 남으니 정보는 안 잃는다.
 */
function safeFilename(title: string): string {
  const cleaned = title
    // OS 가 실제로 거부하는 문자만 바꾼다. 예전에는 하이픈까지 밀어버려서 이름이 필요 이상으로
    // 뭉개졌다.
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    // "A / B / C" 같은 제목이 "A___B___C" 가 되던 걸 "A_B_C" 로 접는다.
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || 'chat').slice(0, 60);
}

/**
 * 기본 파일 이름.
 *
 *     telegram_{대화방 id}_{yyMMdd_HHmmss}_{대화방 이름}.zip
 *
 * 이름보다 **id 를 앞에 둔다.** 대화방 이름은 바뀌고 겹치지만 id 는 안 그렇다.
 *
 * 시각도 이름 앞쪽에 있어서, 파일 목록을 사전순으로 정렬하면 같은 방의 백업이 시간순으로
 * 줄을 선다. 날짜는 로컬 기준이다 — UTC 로 찍으면 밤에 받은 백업이 전날 이름을 달고 나온다.
 *
 * 받은 계정이 누구인지는 파일 이름에 넣지 않는다. 이름만 길어지는 데 비해, 그 정보는
 * `meta.json` 을 열면 나온다.
 */
export function exportFilename(dialog: DialogSummary): string {
  const parts = ['telegram', dialog.id, formatFileTimestamp(), safeFilename(dialog.title)];
  return `${parts.join('_')}.zip`;
}

/**
 * 대화방을 zip 으로 내보낸다.
 *
 * 결과물은 세 파일이다.
 * - `messages.jsonl` — 한 줄에 메시지 하나. 기계가 다시 읽기 위한 원본이다.
 * - `messages.txt`   — 사람이 읽는 형태. 시간순(오래된 것부터)으로 정렬돼 있다.
 * - `meta.json`      — 대화방 정보, 기간, 메시지 수, 내보낸 시각.
 *
 * **오래된 것부터(reverse) 훑는다.** 텔레그램 기본은 최신순인데, 그러면 파일에 역순으로
 * 쌓여서 사람이 읽을 수가 없다. 메모리에 다 모아 뒤집는 방법도 있지만 그러면 스트리밍의
 * 의미가 사라진다.
 */
export async function exportChat({
  dialog,
  account,
  peer,
  sink,
  range,
  include,
  onProgress,
  signal,
}: ExportOptions): Promise<void> {
  const client = requireClient();
  const zip = new ZipWriter(sink);
  const pushJsonl = zip.startFile('messages.jsonl');
  const pushText = zip.startFile('messages.txt');
  /**
   * 첨부만 따로 뽑은 목록.
   *
   * 증거로 쓸 때 필요한 건 "이 대화에 어떤 파일이 오갔는가"의 **명세**다. 메시지 사이에
   * 섞여 있으면 세지도, 나중에 받아 온 파일과 맞춰 보지도 어렵다. 한 줄에 하나씩 뽑아 두면
   * 그대로 목록이 된다.
   */
  const pushAttachments = zip.startFile('attachments.jsonl');

  let count = 0;
  let attachmentCount = 0;
  let lastDate: number | undefined;
  /**
   * 두 번째 단계에서 받을 사진들.
   *
   * **첫 단계에서 받아 끼워 넣을 수는 없다.** fflate 는 먼저 연 파일이 닫혀야 그 뒤에
   * 추가된 파일을 흘려보낸다. 메시지 텍스트를 쓰는 도중에 사진을 넣으면 그 사진들이
   * 전부 메모리에 쌓여서, 디스크로 바로 흘려보내는 구조가 무의미해진다.
   *
   * 그래서 첫 단계에서는 **무엇을 받을지만** 적어 두고, 텍스트 파일을 다 닫은 뒤에 받는다.
   * 여기 쌓이는 건 파일 내용이 아니라 그 위치 정보뿐이라 부담이 작다.
   */
  const photoTasks: PhotoTask[] = [];
  let jsonlBuffer = '';
  let textBuffer = '';
  let attachmentBuffer = '';

  const flush = (last = false) => {
    pushJsonl(jsonlBuffer, last);
    pushText(textBuffer, last);
    pushAttachments(attachmentBuffer, last);
    jsonlBuffer = '';
    textBuffer = '';
    attachmentBuffer = '';
  };

  // 끝 날짜는 그 날 전체를 포함해야 하므로 23:59:59 까지 잡는다.
  const toSeconds = range.to ? endOfDayUnix(range.to) : undefined;
  const previousThreshold = client.floodSleepThreshold;
  client.floodSleepThreshold = EXPORT_FLOOD_SLEEP_THRESHOLD;

  try {
    /**
     * `limit: undefined` 면 GramJS 가 끝까지 훑는다. `offsetDate` 는 reverse 와 함께 쓰면
     * "이 시각 이후부터"가 된다. 끝 경계는 API 에 없으므로 우리가 직접 멈춘다.
     *
     * `waitTime: 1` 로 요청 사이에 1초를 둔다. 없으면 큰 대화방에서 FLOOD_WAIT 을 거의
     * 확실히 밟는다(GramJS 는 3000개가 넘을 때만 자동으로 넣는다).
     */
    for await (const message of client.iterMessages(peer, {
      limit: undefined,
      reverse: true,
      waitTime: 1,
      ...(range.from ? { offsetDate: startOfDayUnix(range.from) } : {}),
    })) {
      if (signal.aborted) throw new Error('EXPORT_CANCELLED');

      const summary = toMessageSummary(message as Api.Message);

      // 끝 경계를 넘었다. 시간순으로 오고 있으므로 여기서 멈추면 된다.
      if (toSeconds !== undefined && summary.date > toSeconds) break;

      jsonlBuffer += `${JSON.stringify(toExportRecord(summary))}\n`;
      textBuffer += toReadableLine(summary);
      if (summary.mediaType) {
        /*
          담기로 한 종류면 zip 안의 어디에 놓일지를 **미리 정해 이 줄에 적는다.** 실제로
          받는 건 나중이지만 경로는 지금 계산할 수 있고(날짜와 파일 id 로만 정해진다),
          그래야 목록과 파일이 같은 값을 가리킨다.
        */
        const media = (message as Api.Message).media;
        const path = include?.photos && isPhoto(summary) ? filePathFor(summary) : undefined;
        if (path && media) photoTasks.push({ messageId: summary.id, path, media });

        attachmentBuffer += `${JSON.stringify({
          messageId: summary.id,
          date: summary.date,
          senderId: summary.senderId ?? null,
          senderName: summary.senderName ?? null,
          kind: summary.mediaType,
          tlClass: summary.mediaClass ?? null,
          file: summary.mediaInfo ?? null,
          /** zip 안의 위치. null 이면 이 백업에 파일이 담기지 않았다는 뜻이다. */
          path: path && media ? path : null,
        })}\n`;
        attachmentCount += 1;
      }
      count += 1;
      lastDate = summary.date;

      if (count % BATCH_SIZE === 0) {
        flush();
        await zip.drain();
        onProgress({ count, bytes: zip.bytesWritten, lastDate });
        await yieldToUi();
      }
    }

    flush(true);

    /**
     * 두 번째 단계 — 사진을 받아 담는다.
     *
     * 텍스트 파일이 모두 닫힌 지금부터는 zip 에 넣는 족족 디스크로 흘러간다.
     *
     * 하나라도 실패했다고 전체를 버리지는 않는다. 오래 걸리는 내보내기에서는 파일 참조가
     * 만료되거나(`FILE_REFERENCE_EXPIRED`) 특정 파일만 거절당하는 일이 실제로 생긴다.
     * **실패한 것은 실패했다고 목록에 적고 나머지를 마저 담는다** — 근거로 쓸 자료에서
     * 중요한 건 "빠진 것이 없다"가 아니라 "무엇이 빠졌는지 안다"이다.
     */
    const saved: {
      messageId: number;
      path: string;
      bytes: number;
      sha256: string | null;
      error?: string;
    }[] = [];

    if (photoTasks.length > 0) {
      onProgress({ count, bytes: zip.bytesWritten, lastDate, phase: 'files', files: 0, totalFiles: photoTasks.length });

      for (let index = 0; index < photoTasks.length; index += FILE_CONCURRENCY) {
        if (signal.aborted) throw new Error('EXPORT_CANCELLED');
        const batch = photoTasks.slice(index, index + FILE_CONCURRENCY);

        // 받는 것은 동시에, 넣는 것은 순서대로. 그래야 메모리에 뜨는 파일 수가 고정된다.
        const downloaded = await Promise.all(
          batch.map(async (task) => {
            try {
              const buffer = await client.downloadMedia(task.media);
              if (!buffer || typeof buffer === 'string' || buffer.length === 0) {
                return { task, error: 'EMPTY' };
              }
              return { task, bytes: new Uint8Array(buffer) };
            } catch (err) {
              return { task, error: describeError(err).code };
            }
          }),
        );

        for (const item of downloaded) {
          if (!item.bytes) {
            saved.push({
              messageId: item.task.messageId,
              path: item.task.path,
              bytes: 0,
              sha256: null,
              error: item.error,
            });
            continue;
          }
          zip.writeBinary(item.task.path, item.bytes);
          saved.push({
            messageId: item.task.messageId,
            path: item.task.path,
            bytes: item.bytes.length,
            sha256: await sha256(item.bytes),
          });
        }

        await zip.drain();
        onProgress({
          count,
          bytes: zip.bytesWritten,
          lastDate,
          phase: 'files',
          files: saved.length,
          totalFiles: photoTasks.length,
        });
        await yieldToUi();
      }

      /**
       * 담긴 파일의 목록.
       *
       * `attachments.jsonl` 은 "대화에 무엇이 오갔나"이고 이쪽은 "이 zip 에 무엇이 들었나"다.
       * 둘은 다르다 — 받기로 하지 않은 것, 받으려다 실패한 것이 그 차이에 있다.
       */
      zip.writeFile('files/index.jsonl', saved.map((item) => JSON.stringify(item)).join('\n') + '\n');
    }

    const failed = saved.filter((item) => item.error).length;

    zip.writeFile(
      'meta.json',
      `${JSON.stringify(
        {
          account: account ?? null,
          dialog: { id: dialog.id, title: dialog.title, kind: dialog.kind },
          range: { from: range.from ?? null, to: range.to ?? null },
          messageCount: count,
          /** 첨부 개수. attachments.jsonl 의 줄 수와 같아야 한다. */
          attachmentCount,
          /**
           * 첨부 파일을 실제로 담았는지, 담았다면 어떤 종류를 담았는지.
           *
           * **나중에 이 백업만 보는 사람이 "빠진 것"과 "원래 없던 것"을 구분할 수 있어야
           * 한다.** 사진을 안 담기로 하고 받은 백업과, 담으려 했는데 다 실패한 백업은
           * 폴더 모양이 같다. 그 둘을 가르는 건 이 세 값뿐이다.
           */
          attachments: {
            included: include?.photos ? ['photo'] : [],
            savedCount: saved.length - failed,
            failedCount: failed,
          },
          /**
           * messages.txt 의 시각이 어느 시간대인지 밝혀 둔다. 이게 없으면 로컬 시간으로
           * 찍힌 파일을 나중에 다른 곳에서 열었을 때 몇 시인지 알 수 없다.
           * `range` 의 날짜도 이 시간대 기준으로 잘린 것이다.
           */
          timezone: localTimeZone(),
          timezoneOffsetMinutes: localOffsetMinutes(),
          exportedAt: new Date().toISOString(),
          exportedBy: 'telegram-chat-exporter',
          // 아바타 데이터를 빼고 필드를 명시적으로 고르면서 구조가 바뀌었다.
          format: 'jsonl-v3',
        },
        null,
        2,
      )}\n`,
    );

    await zip.finish();
    onProgress({ count, bytes: zip.bytesWritten, lastDate });
  } catch (err) {
    await zip.abort();
    if (signal.aborted) throw new Error('EXPORT_CANCELLED');
    throw describeError(err);
  } finally {
    client.floodSleepThreshold = previousThreshold;
  }
}
