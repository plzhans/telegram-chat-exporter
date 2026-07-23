import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';
import { Api } from 'telegram';
import type { Dialog } from 'telegram/tl/custom/dialog';
import { strippedPhotoToJpg } from 'telegram/Utils';
import bigInt from 'big-integer';
import { requireClient } from '@/shared/auth/useAuth';
import { describeError, type TelegramErrorInfo } from '@/shared/telegram/errors';
import { formatPersonName } from '@/shared/lib/name';
import { dateKeyOf, toUnix } from '@/shared/lib/date';

export type DialogKind = 'user' | 'group' | 'channel';

export interface DialogSummary {
  /** 텔레그램 peer id. bigInt 라 문자열로 눕혀 둔다 — React key 와 라우트 파라미터로 쓴다. */
  id: string;
  title: string;
  kind: DialogKind;
  unreadCount: number;
  /** 마지막 메시지 시각(Unix 초). 목록 정렬은 텔레그램이 준 순서를 그대로 쓰고, 표시용이다. */
  date: number;
  /** 프로필 사진 data URL. 사진이 없는 대화방이면 undefined. */
  photo?: string;
}

/**
 * 대화방 목록 응답에 딸려 온 프로필 사진을 꺼낸다.
 *
 * **네트워크 요청이 추가로 나가지 않는다.** 텔레그램은 엔티티 안에 `strippedThumb` 라는
 * 초소형 JPEG(보통 수백 바이트)을 같이 실어 보낸다. 공식 클라이언트가 목록을 즉시 그릴 때
 * 쓰는 것과 같은 데이터다. 진짜 사진은 `downloadProfilePhoto` 로 받아야 하는데, 그건
 * **대화방 하나당 요청 하나**라 200개 목록에서 돌리면 FLOOD_WAIT 을 정면으로 맞는다.
 *
 * `strippedThumb` 은 JPEG 헤더가 제거된 형식이라 그대로는 못 쓴다. 복원은 GramJS 의
 * `strippedPhotoToJpg` 가 해 준다.
 *
 * blob URL 대신 data URL 을 쓰는 이유는 **해제 관리를 하지 않기 위해서다.** 썸네일 하나가
 * base64 로도 1KB 남짓이라 200개를 담아도 수십 KB고, 목록이 다시 그려질 때마다
 * `URL.revokeObjectURL` 을 챙길 필요가 없다.
 */
function extractPhoto(entity: unknown): string | undefined {
  if (!entity || typeof entity !== 'object') return undefined;
  if (!('photo' in entity) || !entity.photo || typeof entity.photo !== 'object') return undefined;

  const photo = entity.photo as { strippedThumb?: Parameters<typeof strippedPhotoToJpg>[0] };
  if (!photo.strippedThumb) return undefined;

  try {
    // strippedThumb 은 이미 GramJS 의 Buffer 타입이라 감쌀 필요가 없다. 전역 Buffer 를
    // 참조하면 앱 tsconfig 의 types 에 node 가 없어서 타입 에러가 난다(런타임엔 폴리필로 존재).
    const jpg = strippedPhotoToJpg(photo.strippedThumb);
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch {
    // 썸네일 하나 못 만든 걸로 목록 전체를 날릴 이유는 없다. 이니셜 아바타로 떨어진다.
    return undefined;
  }
}

/**
 * peer id → InputPeer 캐시.
 *
 * 상세 화면은 URL 의 id 문자열만 받는데, GramJS 에 메시지를 요청하려면 InputPeer 가 있어야
 * 한다. `getEntity(id)` 로 되찾는 방법도 있지만 그건 세션 캐시에 엔티티가 있을 때만 되고
 * 채널·유저마다 access_hash 가 필요해서 실패하기 쉽다. 이미 손에 들어온 InputPeer 를 그대로
 * 들고 있는 게 확실하다.
 *
 * **대화방뿐 아니라 메시지 발신자도 여기 들어간다.** 그룹 대화에서 말한 사람의 프로필 사진을
 * 받으려면 그 사람의 InputPeer 가 필요한데, 대화방 목록에는 당연히 없다. 메시지를 훑을 때
 * 딸려 오는 `inputSender` 를 같이 담아 둔다.
 *
 * 새로고침하면 비지만, 새로고침은 어차피 로그인부터 다시라(세션을 저장하지 않는다) 상관없다.
 */
const peerCache = new Map<string, Api.TypeInputPeer>();

export function getCachedPeer(id: string): Api.TypeInputPeer | undefined {
  return peerCache.get(id);
}

function kindOf(dialog: Dialog): DialogKind {
  if (dialog.isUser) return 'user';
  // isChannel 을 먼저 본다. 슈퍼그룹은 isGroup 과 isChannel 이 동시에 참이라 순서를 바꾸면
  // 채널이 전부 그룹으로 뭉개진다.
  if (dialog.isChannel && !dialog.isGroup) return 'channel';
  return dialog.isGroup ? 'group' : 'channel';
}

/**
 * 한 번에 가져올 대화방 수.
 *
 * GramJS 의 getDialogs 는 내부에서 페이지를 넘겨 가며 이 개수를 채운다. 계정에 대화방이
 * 수천 개면 그만큼 요청이 늘고 FLOOD_WAIT 확률이 올라가므로 일단 여기서 끊는다.
 */
const DIALOG_LIMIT = 200;

export function useDialogsQuery() {
  return useQuery<DialogSummary[], TelegramErrorInfo>({
    queryKey: ['dialogs'],
    queryFn: async () => {
      const client = requireClient();
      try {
        const dialogs = await client.getDialogs({ limit: DIALOG_LIMIT });
        return dialogs.map((dialog) => {
          const id = dialog.id?.toString() ?? '';
          if (dialog.inputEntity) peerCache.set(id, dialog.inputEntity);
          return {
            id,
            title: dialog.title || dialog.name || '(제목 없음)',
            kind: kindOf(dialog),
            unreadCount: dialog.unreadCount,
            date: dialog.date,
            photo: extractPhoto(dialog.entity),
          };
        });
      } catch (err) {
        // 화면이 RPC 에러를 직접 헤집지 않도록 여기서 정규화해서 던진다.
        throw describeError(err);
      }
    },
  });
}

export interface ChatStats {
  /** 대화방의 전체 메시지 수. */
  total: number;
  /** 가장 오래된 메시지 시각(Unix 초). 메시지가 없으면 undefined. */
  firstDate?: number;
  /** 가장 최근 메시지 시각(Unix 초). */
  lastDate?: number;
}

/**
 * 내보내기 **전에** 대화방의 규모와 기간을 알아낸다.
 *
 * 전체 개수는 `getMessages(limit: 1)` 응답의 `total` 에 실려 온다 — 메시지 한 건만 받으면서
 * 전체 수를 알 수 있는 확실한 경로다. **이것만 실패로 처리한다.**
 *
 * 가장 오래된 메시지 날짜는 달력 API 가 곁다리로 주는 `minDate` 를 쓴다. 예전에는
 * `getMessages(limit: 1, reverse: true)` 로 첫 메시지를 직접 받았는데, 그 조합은 GramJS 가
 * `addOffset` 을 음수로 밀어 넣어서 대화방에 따라 거부당한다. 없으면 없는 대로 두는 편이 낫다 —
 * 총 개수만 있어도 "얼마나 걸릴 작업인지"는 판단할 수 있다.
 *
 * 마지막 메시지 시각은 대화방 목록에 이미 있으므로 인자로 받는다. 요청을 쓸 이유가 없다.
 */
export function useChatStatsQuery(dialogId: string, lastDate?: number) {
  return useQuery<ChatStats, TelegramErrorInfo>({
    queryKey: ['chat-stats', dialogId],
    queryFn: async () => {
      const peer = getCachedPeer(dialogId);
      if (!peer) throw { code: 'PEER_NOT_CACHED', raw: 'PEER_NOT_CACHED' } as TelegramErrorInfo;

      const client = requireClient();

      let total: number;
      try {
        const newest = await client.getMessages(peer, { limit: 1 });
        total = newest.total ?? newest.length;
      } catch (err) {
        throw describeError(err);
      }

      /**
       * 가장 오래된 메시지.
       *
       * `reverse: true` 면 GramJS 가 `offsetId = 1` 로 두고 맨 앞에서부터 읽으므로 한 건만
       * 받아도 그게 첫 메시지다. 한때 이 조합을 의심해 달력 API 의 `minDate` 로 갈아탔는데,
       * **그 달력 API 쪽이 오히려 실패해서 기간이 통째로 비어 버렸다.** reverse 경로는
       * 24만 건짜리 내보내기가 이미 같은 방식으로 돌았으니 검증된 쪽이다.
       */
      let firstDate: number | undefined;
      try {
        const oldest = await client.getMessages(peer, { limit: 1, reverse: true });
        firstDate = oldest[0]?.date;
      } catch (err) {
        // 기간 표시는 부가 정보다. 실패해도 총 개수는 살린다.
        console.warn('[telegram-chat-exporter] 첫 메시지를 가져오지 못했습니다:', err);
      }

      return { total, firstDate, lastDate };
    },
  });
}

/**
 * 첨부 파일의 신원.
 *
 * 이 앱은 대화를 **근거로 남기려고** 쓰는 도구다. "이 사진이 그때 그 사진인가"를 가릴 수
 * 있어야 하는데, 화면에 보이는 그림만으로는 못 가린다. 텔레그램이 파일마다 붙여 둔 id 가
 * 그 역할을 한다 — 같은 파일이면 누가 어디서 받아도 같은 값이다.
 */
export interface MediaInfo {
  /** 텔레그램이 이 파일에 붙인 고유 id. */
  id: string;
  /** 파일을 다시 받을 때 필요한 값. id 와 짝을 이룬다. */
  accessHash?: string;
  /** 어느 데이터센터에 있는지. */
  dcId?: number;
  /** 파일이 텔레그램에 올라온 시각(Unix 초). **메시지 시각과 다를 수 있다** — 전달된 파일이면. */
  date?: number;
  /** 바이트 크기. 사진은 우리가 보여주는 판 기준이라 원본과 다를 수 있다. */
  size?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  fileName?: string;
  /** 영상·음성 길이(초). */
  duration?: number;
}

export interface MessageSummary {
  id: number;
  /** Unix 초. */
  date: number;
  text: string;
  /** 내가 보낸 메시지인지. 말풍선 정렬에 쓴다. */
  out: boolean;
  senderName?: string;
  /** 발신자 id. 아바타 색을 고정하고, 같은 사람이 연달아 말했는지 판단하는 데 쓴다. */
  senderId?: string;
  /**
   * 발신자 종류.
   *
   * 봇을 구분해 두는 이유는 기록을 근거로 쓸 때 **사람이 한 말과 자동 발송을 섞으면 안 되기**
   * 때문이다. 이름만으로는 봇인지 알 수 없다 — 봇도 사람 이름을 쓸 수 있다.
   */
  senderKind: 'user' | 'bot' | 'channel';
  /** 발신자 프로필 사진 data URL. 대화방 아이콘과 같은 방식으로 추가 요청 없이 얻는다. */
  senderPhoto?: string;
  /**
   * 첨부 종류. `photo` `sticker` `video` `voice` `file` 처럼 알아볼 수 있는 이름이다.
   * 본문 없이 미디어만 있는 메시지도 많다.
   */
  mediaType?: string;
  /** 첨부 파일의 신원. 근거로 쓸 때 "그 파일이 이 파일인가"를 가릴 유일한 값이다. */
  mediaInfo?: MediaInfo;
  /**
   * 첨부의 원래 TL 클래스 이름(`MessageMediaDocument` 등).
   *
   * 우리가 아직 다루지 못하는 종류가 와도 **무엇이었는지는 남아야** 한다. 화면에는 요약된
   * 이름을 쓰지만 내보내기에는 이 값도 함께 적어서, 나중에 형태를 되짚을 수 있게 한다.
   */
  mediaClass?: string;
  /**
   * 붙은 사진의 초저해상도 미리보기(data URL).
   *
   * 프로필 사진과 같은 `PhotoStrippedSize` 다 — 메시지 응답에 딸려 오므로 **요청이 들지
   * 않는다.** 수십 px 짜리라 뿌옇지만, 선명한 판이 도착하기 전까지 자리를 잡아 준다.
   */
  mediaThumb?: string;
  /** 선명한 썸네일을 받아올 때 쓰는 열쇠. 사진이 붙은 메시지에만 있다. */
  mediaKey?: string;
  /** 원본 비율. 이미지가 도착하기 전에도 자리를 정확히 잡아 두려고 쓴다. */
  mediaWidth?: number;
  mediaHeight?: number;
  /**
   * 앨범 묶음 id.
   *
   * 사진 여러 장을 **한 번에 올리면** 텔레그램은 그것들을 각각의 메시지로 저장하면서 같은
   * `groupedId` 를 달아 준다. 받는 쪽에서 그 값으로 다시 묶어야 올린 사람이 의도한 대로
   * 한 덩어리로 보인다. 안 묶으면 사진 한 장짜리 말풍선이 줄줄이 늘어선다.
   */
  groupedId?: string;
  /** "님이 들어왔습니다" 같은 시스템 메시지면 그 종류 이름. */
  actionType?: string;
  /** 시스템 메시지의 원래 TL 클래스 이름. 다루지 못하는 종류도 형태는 남긴다. */
  actionClass?: string;
  /**
   * 마지막으로 고쳐진 시각(Unix 초). 고친 적이 없으면 undefined.
   *
   * 기록을 근거로 쓸 때 **원문 그대로인지 나중에 손댄 것인지**는 다른 사실이다. 텔레그램이
   * 알려주는 이상 화면과 내보내기 양쪽에 남긴다.
   */
  editDate?: number;
}

/**
 * 사진이 붙은 메시지의 원본. 선명한 썸네일을 받을 때 필요하다.
 *
 * `downloadMedia` 는 메시지 객체를 요구하는데, 화면에 넘기는 `MessageSummary` 는 평범한
 * 객체라 그걸 들고 있지 않다. 그렇다고 요약에 TL 객체를 통째로 실으면 내보내기 파일까지
 * 따라 들어간다(예전에 프로필 사진이 그렇게 새어 나갔다). 그래서 여기 따로 둔다.
 */
const mediaMessageCache = new Map<string, Api.Message>();

export function getCachedMediaMessage(key: string): Api.Message | undefined {
  return mediaMessageCache.get(key);
}

/**
 * 사진과 문서에서 미리보기 목록을 꺼낸다.
 *
 * **스티커·영상·GIF 는 전부 `Document` 다.** 사진처럼 `sizes` 가 아니라 `thumbs` 에 미리보기가
 * 들어 있어서 꺼내는 자리가 다르다. 그 차이만 여기서 흡수하면 아래 로직은 둘을 똑같이 다룬다.
 */
function previewSizesOf(media: unknown): Api.TypePhotoSize[] {
  if (media instanceof Api.Photo) return media.sizes;
  if (media instanceof Api.Document) return media.thumbs ?? [];
  return [];
}

/** **요청 없이** 꺼낼 수 있는 초저해상도 미리보기. */
function extractStrippedPhoto(media: unknown): string | undefined {
  const stripped = previewSizesOf(media).find(
    (size): size is Api.PhotoStrippedSize => size instanceof Api.PhotoStrippedSize,
  );
  if (!stripped) return undefined;
  try {
    return `data:image/jpeg;base64,${strippedPhotoToJpg(stripped.bytes).toString('base64')}`;
  } catch {
    return undefined;
  }
}

/** 화면에 띄우기 좋은 크기의 썸네일. 원본을 받으면 몇 MB 씩 나가므로 쓰지 않는다. */
export function pickThumbSize(media: unknown): Api.PhotoSize | undefined {
  const sizes = previewSizesOf(media).filter(
    (size): size is Api.PhotoSize => size instanceof Api.PhotoSize,
  );
  if (sizes.length === 0) return undefined;
  const ascending = [...sizes].sort((a, b) => a.w - b.w);
  // 말풍선 폭에서 뭉개지지 않을 정도만. 그보다 큰 게 없으면 있는 것 중 가장 큰 걸 쓴다.
  return ascending.find((size) => size.w >= 320) ?? ascending[ascending.length - 1];
}

/**
 * TL 객체의 종류 이름.
 *
 * **`constructor.name` 을 쓰면 안 된다.** GramJS 의 TL 객체는 전부 `VirtualClass` 를 상속해
 * 만들어져서 개발 중에도 그 이름이 나오고, 프로덕션 빌드에서는 압축까지 겹쳐 `de` 같은
 * 두 글자로 줄어든다. 실제로 화면에 "첨부: de" 가 찍혔다.
 *
 * `className` 은 클래스마다 **문자열 값으로 박아 둔 것**이라 압축의 영향을 받지 않는다.
 */
function classNameOf(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const name = (value as { className?: unknown }).className;
  return typeof name === 'string' ? name : undefined;
}

/** `MessageMediaPhoto` → `photo`. 접두사를 떼고 소문자로. */
function shortTypeName(value: unknown, prefix: string): string | undefined {
  const name = classNameOf(value);
  if (!name) return undefined;
  return name.startsWith(prefix) ? name.slice(prefix.length).toLowerCase() : name;
}

/**
 * 첨부의 종류를 사람이 알아볼 수 있는 이름으로.
 *
 * 텔레그램은 스티커·영상·음성·GIF·일반 파일을 **전부 `MessageMediaDocument` 하나로** 보낸다.
 * 그래서 미디어 클래스만 봐서는 "문서"까지밖에 모른다. 진짜 종류는 문서에 붙은 속성
 * (`DocumentAttributeSticker` 등)에 들어 있어서 그걸 들춰봐야 한다.
 */
function describeMedia(
  media: unknown,
): { kind: string; raw: string; info?: MediaInfo } | undefined {
  const raw = classNameOf(media);
  if (!raw || raw === 'MessageMediaEmpty') return undefined;

  if (media instanceof Api.MessageMediaPhoto && media.photo instanceof Api.Photo) {
    const photo = media.photo;
    const largest = [...photo.sizes]
      .filter((size): size is Api.PhotoSize => size instanceof Api.PhotoSize)
      .sort((a, b) => a.w - b.w)
      .pop();
    return {
      kind: 'photo',
      raw,
      info: {
        id: photo.id.toString(),
        accessHash: photo.accessHash?.toString(),
        dcId: photo.dcId,
        date: photo.date,
        size: largest?.size,
        width: largest?.w,
        height: largest?.h,
      },
    };
  }

  if (media instanceof Api.MessageMediaDocument && media.document instanceof Api.Document) {
    const document = media.document;
    const attributes = document.attributes.map((attribute) => classNameOf(attribute));
    const named = document.attributes.find(
      (attribute): attribute is Api.DocumentAttributeFilename =>
        attribute instanceof Api.DocumentAttributeFilename,
    );
    const sized = document.attributes.find(
      (attribute): attribute is Api.DocumentAttributeVideo | Api.DocumentAttributeImageSize =>
        attribute instanceof Api.DocumentAttributeVideo ||
        attribute instanceof Api.DocumentAttributeImageSize,
    );

    const info: MediaInfo = {
      id: document.id.toString(),
      accessHash: document.accessHash?.toString(),
      dcId: document.dcId,
      date: document.date,
      size: Number(document.size),
      mimeType: document.mimeType,
      fileName: named?.fileName,
      width: sized?.w,
      height: sized?.h,
    };

    const video = document.attributes.find(
      (attribute): attribute is Api.DocumentAttributeVideo =>
        attribute instanceof Api.DocumentAttributeVideo,
    );
    const audio = document.attributes.find(
      (attribute): attribute is Api.DocumentAttributeAudio =>
        attribute instanceof Api.DocumentAttributeAudio,
    );
    info.duration = video?.duration ?? audio?.duration;

    /*
      순서가 중요하다. 스티커는 영상 속성을 함께 달고 오는 경우가 있고(움직이는 스티커),
      음성 메모와 일반 음악은 같은 `DocumentAttributeAudio` 에 플래그로만 갈린다.
    */
    if (attributes.includes('DocumentAttributeSticker')) return { kind: 'sticker', raw, info };
    if (attributes.includes('DocumentAttributeAnimated')) return { kind: 'gif', raw, info };
    if (video?.roundMessage) return { kind: 'videoNote', raw, info };
    if (video) return { kind: 'video', raw, info };
    if (audio?.voice) return { kind: 'voice', raw, info };
    if (audio) return { kind: 'audio', raw, info };
    return { kind: 'file', raw, info };
  }

  return { kind: shortTypeName(media, 'MessageMedia') ?? raw, raw };
}

export function toMessageSummary(message: Api.Message): MessageSummary {
  const sender = message.sender;
  let senderName: string | undefined;
  let senderKind: MessageSummary['senderKind'] = 'user';
  if (sender && 'firstName' in sender) {
    senderName = formatPersonName(sender.firstName, sender.lastName) || undefined;
    // Api.User 의 `bot` 플래그. 봇 계정이면 텔레그램이 직접 표시해 준다.
    if ('bot' in sender && sender.bot) senderKind = 'bot';
  } else if (sender && 'title' in sender) {
    senderName = sender.title;
    senderKind = 'channel';
  }

  const senderId = message.senderId?.toString();

  /**
   * 발신자의 InputPeer 를 캐시에 넣어 둔다. 이게 있어야 나중에 그 사람의 선명한 프로필
   * 사진을 받을 수 있다(lib/profilePhoto.ts). 여기서 안 담아 두면 그룹 대화의 발신자는
   * access_hash 를 알 방법이 없어 다운로드가 조용히 실패한다.
   */
  if (senderId && message.inputSender && !peerCache.has(senderId)) {
    peerCache.set(senderId, message.inputSender);
  }

  /**
   * 사진이 붙어 있으면 미리보기와 열쇠를 챙긴다.
   *
   * 원본 메시지는 별도 캐시에 넣는다 — 선명한 판을 받을 때 `downloadMedia` 가 그걸 요구한다.
   */
  const media = describeMedia(message.media);
  let mediaThumb: string | undefined;
  let mediaKey: string | undefined;
  let mediaWidth: number | undefined;
  let mediaHeight: number | undefined;
  /**
   * 사진과 문서(스티커·영상·GIF)를 같은 길로 태운다.
   *
   * 미리보기가 들어 있는 자리만 다를 뿐(`sizes` 대 `thumbs`) 그 뒤는 똑같다. 스티커도
   * 결국 그림이라 별도 경로를 팔 이유가 없다 — 움직이는 스티커라도 미리보기는 정지 화상이라
   * 그대로 보여줄 수 있다.
   */
  const file =
    message.media instanceof Api.MessageMediaPhoto && message.media.photo instanceof Api.Photo
      ? message.media.photo
      : message.media instanceof Api.MessageMediaDocument &&
          message.media.document instanceof Api.Document
        ? message.media.document
        : undefined;

  if (file) {
    mediaThumb = extractStrippedPhoto(file);
    const size = pickThumbSize(file);
    if (size) {
      mediaWidth = size.w;
      mediaHeight = size.h;
      mediaKey = `${message.chatId?.toString() ?? '0'}:${message.id}`;
      mediaMessageCache.set(mediaKey, message);
    }
  }

  return {
    id: message.id,
    date: message.date,
    text: message.message ?? '',
    out: Boolean(message.out),
    mediaThumb,
    mediaKey,
    mediaWidth,
    mediaHeight,
    groupedId: message.groupedId?.toString(),
    editDate: message.editDate ?? undefined,
    senderName: senderName ?? senderId,
    senderId,
    senderKind,
    // 발신자 엔티티에도 strippedThumb 이 실려 온다. 대화방 아이콘과 같은 공짜 경로다.
    senderPhoto: extractPhoto(sender),
    mediaType: media?.kind,
    mediaInfo: media?.info,
    mediaClass: media?.raw,
    actionType: shortTypeName(message.action, 'MessageAction'),
    actionClass: classNameOf(message.action),
  };
}

/** 화면에 한 번에 붙일 메시지 수. 스크롤 한 화면을 채우고도 남는 정도. */
const MESSAGE_PAGE_SIZE = 50;

/**
 * 메시지 창을 어디에 걸어 둘지.
 *
 * `latest` 는 늘 있던 동작(최신 메시지부터), `date` 는 달력에서 특정 날짜를 골랐을 때다.
 */
export type MessageAnchor = { type: 'latest' } | { type: 'date'; unix: number };

interface MessagePage {
  /** 항상 **오래된 것부터** 정렬해 둔다. 요청 방향이 섞여도 화면 코드가 신경 쓸 필요 없게. */
  messages: MessageSummary[];
  minId?: number;
  maxId?: number;
  /** 이 페이지가 대화의 시작/끝에 닿았는지. 더보기 버튼을 숨길지 판단한다. */
  atOldest: boolean;
  atNewest: boolean;
}

type PageParam =
  | { dir: 'anchor' }
  | { dir: 'older'; offsetId: number }
  | { dir: 'newer'; offsetId: number };

/**
 * 앵커를 중심으로 **양쪽으로** 넓혀 가며 메시지를 가져온다.
 *
 * 특정 날짜로 점프하면 그 지점은 대화 중간이다. 그러면 위로도(이전) 아래로도(이후) 이어
 * 볼 수 있어야 하므로 한쪽 방향 페이징으로는 부족하다. TanStack Query 의 양방향
 * infinite query 를 그대로 쓴다.
 *
 * - `fetchPreviousPage` → **이전(오래된)** 메시지. 화면 위에 붙는다.
 * - `fetchNextPage`     → **이후(최신)** 메시지. 화면 아래에 붙는다.
 *
 * 이 방향 매핑이 헷갈리기 쉬운데, 렌더링 순서(위가 과거)와 맞춘 것이다. 그래서
 * `pages.flatMap(p => p.messages)` 하나로 시간순 목록이 나온다.
 */
export function useMessagesQuery(dialogId: string, anchor: MessageAnchor) {
  const anchorKey = anchor.type === 'latest' ? 'latest' : `date:${anchor.unix}`;

  return useInfiniteQuery<MessagePage, TelegramErrorInfo, InfiniteData<MessagePage>, unknown[], PageParam>({
    // 앵커가 바뀌면 창을 통째로 새로 만든다. 같은 캐시에 이어 붙이면 중간이 빈 목록이 된다.
    queryKey: ['messages', dialogId, anchorKey],
    initialPageParam: { dir: 'anchor' },
    queryFn: async ({ pageParam }) => {
      const peer = getCachedPeer(dialogId);
      if (!peer) throw { code: 'PEER_NOT_CACHED', raw: 'PEER_NOT_CACHED' } as TelegramErrorInfo;

      const client = requireClient();
      try {
        let raw;
        let atOldest = false;
        let atNewest = false;

        if (pageParam.dir === 'anchor') {
          if (anchor.type === 'latest') {
            raw = await client.getMessages(peer, { limit: MESSAGE_PAGE_SIZE });
            atNewest = true;
            atOldest = raw.length < MESSAGE_PAGE_SIZE;
          } else {
            /**
             * `reverse: true` + `offsetDate` 는 "이 시각 이후부터 시간순으로"가 된다.
             * 메시지 id 로 점프하지 않는 이유는 경계 포함 여부가 애매해서다 — 그 날의 첫
             * 메시지를 하나 빠뜨리기 쉽다. 날짜는 그런 off-by-one 이 없다.
             */
            raw = await client.getMessages(peer, {
              limit: MESSAGE_PAGE_SIZE,
              reverse: true,
              offsetDate: anchor.unix,
            });
            atNewest = raw.length < MESSAGE_PAGE_SIZE;
          }
        } else if (pageParam.dir === 'older') {
          raw = await client.getMessages(peer, {
            limit: MESSAGE_PAGE_SIZE,
            offsetId: pageParam.offsetId,
          });
          atOldest = raw.length < MESSAGE_PAGE_SIZE;
        } else {
          raw = await client.getMessages(peer, {
            limit: MESSAGE_PAGE_SIZE,
            reverse: true,
            offsetId: pageParam.offsetId,
          });
          atNewest = raw.length < MESSAGE_PAGE_SIZE;
        }

        // 요청 방향에 따라 오는 순서가 다르다. 여기서 한 번에 시간순으로 눕힌다.
        const messages = raw.map(toMessageSummary).sort((a, b) => a.id - b.id);
        return {
          messages,
          minId: messages[0]?.id,
          maxId: messages[messages.length - 1]?.id,
          atOldest,
          atNewest,
        };
      } catch (err) {
        throw describeError(err);
      }
    },
    getPreviousPageParam: (firstPage) =>
      firstPage.atOldest || firstPage.minId === undefined
        ? undefined
        : { dir: 'older', offsetId: firstPage.minId },
    getNextPageParam: (lastPage) =>
      lastPage.atNewest || lastPage.maxId === undefined
        ? undefined
        : { dir: 'newer', offsetId: lastPage.maxId },
  });
}


/** 달력 한 칸. */
export interface CalendarDay {
  /** 그 날 00:00 의 Unix 초(로컬 기준). */
  date: number;
  count: number;
}

/**
 * "이 시각보다 최신인 메시지가 몇 개인지"를 구한다.
 *
 * `messages.getHistory` 응답의 `offsetIdOffset` 이 **결과 전체에서 messages[0] 이 몇 번째인지**를
 * 알려준다. offsetDate 를 T 로 주면 messages[0] 은 "T 직전의 메시지"이므로, 그 값이 곧
 * T 보다 새로운 메시지의 개수다.
 *
 * 작은 대화방은 `messages.Messages` 로 전부 한 번에 오는데, 그때는 위치 정보가 없으므로
 * 배열을 직접 세어 같은 값을 만든다.
 */
async function countNewerThan(peer: Api.TypeInputPeer, unixSeconds: number): Promise<number> {
  const result = await requireClient().invoke(
    new Api.messages.GetHistory({
      peer,
      offsetId: 0,
      offsetDate: unixSeconds,
      addOffset: 0,
      limit: 1,
      maxId: 0,
      minId: 0,
      hash: bigInt.zero,
    }),
  );

  if (
    result instanceof Api.messages.MessagesSlice ||
    result instanceof Api.messages.ChannelMessages
  ) {
    return result.offsetIdOffset ?? 0;
  }
  if (result instanceof Api.messages.Messages) {
    return result.messages.filter((m) => 'date' in m && m.date >= unixSeconds).length;
  }
  return 0;
}

/**
 * 동시에 던지는 경계 조회 수.
 *
 * 하나씩 순서대로 물으면 왕복 시간이 그대로 누적돼 한 달에 30초씩 걸린다. 그렇다고 31개를
 * 한꺼번에 던지면 FLOOD_WAIT 을 밟는다. 넷 정도가 체감 속도와 안전 사이의 타협점이다.
 */
const BOUNDARY_CONCURRENCY = 4;

export interface DayCountProgress {
  /** 지금까지 확정된 날짜별 개수. 받는 대로 갱신된다. */
  days: CalendarDay[];
  done: number;
  total: number;
  /**
   * 방금 확인이 끝난 날짜 경계(Unix 초).
   *
   * 숫자만 올라가는 것보다 "지금 며칠을 보고 있다"가 보이는 편이 멈춘 게 아니라는 신호가
   * 훨씬 분명하다. 동시에 넷씩 던지므로 순서대로 오지는 않는다.
   */
  at: number;
}

/**
 * 한 달치 날짜별 메시지 수를 잰다.
 *
 * **비용이 메시지 양과 무관하다.** 날짜 경계마다 위치를 한 번 물어보고 그 차이를 내므로
 * 대화가 10건이든 10만건이든 요청 수가 같다.
 *
 * 그 위에 **물어볼 필요가 없는 경계를 먼저 걷어낸다.** 이게 실제 체감을 가장 크게 바꾼다.
 * - **미래**: 오늘 이후에는 메시지가 있을 수 없다. 경계 값이 무조건 0 이라 요청 자체를 안 한다.
 * - **이미 아는 날**: 대화창에 그려 둔 메시지에서 "이 날은 있다"가 확정된 날들이다. 구간의
 *   앞뒤 끝에 붙어 있으면 잘라낼 수 있다(가운데 있는 건 이웃 날의 경계로 쓰여서 못 뺀다).
 *
 * 7월에 오늘이 23일이고 20~23일을 이미 아는 상황이면 32번이 아니라 **20번**으로 끝난다.
 *
 * 남은 요청도 넷씩 겹쳐 던지고, 다 끝나기를 기다리지 않고 양옆 경계가 확정된 날부터
 * `onProgress` 로 흘려보낸다.
 */
export async function fetchDayCounts(
  peer: Api.TypeInputPeer,
  year: number,
  monthIndex: number,
  signal: AbortSignal,
  onProgress: (progress: DayCountProgress) => void,
  /** 대화창에서 이미 확인된 날짜들(`yyyy-mm-dd`). 조회 구간을 줄이는 데만 쓴다. */
  knownDays?: Set<string>,
  /** 이 대화방의 첫 메시지 시각(Unix 초). 그 이전은 물어볼 필요가 없다. */
  firstMessageUnix?: number,
  /** 마지막 메시지 시각(Unix 초). 그 이후도 마찬가지다. */
  lastMessageUnix?: number,
): Promise<CalendarDay[]> {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  /** 경계는 **로컬 자정**이다. 이 값이 곧 기준이라 서버 시간대와 어긋날 여지가 없다. */
  const boundaryUnix = (day: number) => toUnix(new Date(year, monthIndex, day));
  const nowUnix = Math.floor(Date.now() / 1000);
  const dayKey = (day: number) => dateKeyOf(boundaryUnix(day));

  /**
   * 위쪽 한계. 오늘 이후에는 메시지가 있을 수 없고, **마지막 메시지 이후도 마찬가지다.**
   * 둘 중 이른 쪽을 쓴다 — 대화가 몇 달 전에 끊긴 방이면 그 뒤로는 물어볼 이유가 없다.
   */
  const ceiling = Math.min(nowUnix, lastMessageUnix ?? nowUnix);
  let hi = daysInMonth;
  while (hi >= 1 && boundaryUnix(hi) > ceiling) hi -= 1;

  let lo = 1;

  /**
   * 대화가 시작되기 전은 통째로 뺀다.
   *
   * 그 날이 **끝날 때까지도** 첫 메시지 시각에 못 미치면 그 날에는 메시지가 있을 수 없다.
   * 몇 년 된 대화방의 지난 달들을 훑을 때 이 한 줄이 요청을 통째로 없앤다.
   */
  if (firstMessageUnix !== undefined) {
    while (lo <= hi && boundaryUnix(lo + 1) <= firstMessageUnix) lo += 1;
  }

  // 구간 양 끝에서 "이미 아는 날"을 깎는다.
  while (hi >= lo && knownDays?.has(dayKey(hi))) hi -= 1;
  while (lo <= hi && knownDays?.has(dayKey(lo))) lo += 1;

  if (lo > hi) {
    // 물어볼 게 없다. 아는 것만으로 이 달이 다 설명된다.
    onProgress({ days: [], done: 1, total: 1, at: boundaryUnix(1) });
    return [];
  }

  /** 조회해야 할 경계들. 마지막 날의 끝을 닫으려면 `hi + 1` 까지 필요하다. */
  const targets: number[] = [];
  for (let day = lo; day <= hi + 1; day++) {
    // 미래 경계의 답은 0 이다. 물어볼 이유가 없다.
    if (boundaryUnix(day) <= nowUnix) targets.push(day);
  }

  const values = new Map<number, number>();
  // 미래 경계는 요청 없이 0 으로 채운다.
  for (let day = lo; day <= hi + 1; day++) {
    if (boundaryUnix(day) > nowUnix) values.set(day, 0);
  }

  const total = targets.length;
  let done = 0;

  const collect = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    for (let day = lo; day <= hi; day++) {
      const start = values.get(day);
      const end = values.get(day + 1);
      // 양쪽 경계가 다 와야 그 날의 개수가 확정된다.
      if (start === undefined || end === undefined) continue;
      const count = start - end;
      if (count > 0) days.push({ date: boundaryUnix(day), count });
    }
    return days;
  };

  const probe = async (day: number) => {
    if (signal.aborted) throw new DOMException('calendar aborted', 'AbortError');
    values.set(day, await countNewerThan(peer, boundaryUnix(day)));
    done += 1;
    onProgress({ days: collect(), done, total, at: boundaryUnix(day) });
  };

  let next = 0;
  await Promise.all(
    Array.from({ length: BOUNDARY_CONCURRENCY }, async () => {
      while (true) {
        const index = next++;
        if (index >= targets.length) return;
        await probe(targets[index]);
      }
    }),
  );

  return collect();
}

/**
 * 특정 하루에 메시지가 몇 개인지. 경계 두 개의 차이라 요청 두 번이면 끝난다.
 *
 * 달력에서 아직 확인 안 한 날을 눌렀을 때 **이동하기 전에** 물어보는 용도다. 빈 날로
 * 점프하면 텔레그램이 그 뒤의 아무 날이나 보여주는데, 그러면 사용자는 자기가 고른 날을
 * 본다고 착각한다.
 */
export async function countMessagesOnDay(
  peer: Api.TypeInputPeer,
  dayStartUnix: number,
  nextDayStartUnix: number,
): Promise<number> {
  const atStart = await countNewerThan(peer, dayStartUnix);
  const atEnd = await countNewerThan(peer, nextDayStartUnix);
  return atStart - atEnd;
}
