import { requireClient } from '@/shared/auth/useAuth';
import { getCachedMediaMessage, pickThumbSize } from '../api';
import { Api } from 'telegram';
import { readSticker, writeSticker } from './stickerCache';

/**
 * 스티커면 그 문서 id 를 돌려준다.
 *
 * 스티커만 새로고침 뒤에도 남긴다. 전역 공유 자산이라 개인 정보가 아니고, 다른 DC 에 있어서
 * 매번 다시 받으면 첫 로딩이 한참 걸린다(stickerCache 주석 참고).
 */
function stickerIdOf(message: Api.Message | undefined): string | undefined {
  return stickerDocumentOf(message)?.id.toString();
}

function stickerDocumentOf(message: Api.Message | undefined): Api.Document | undefined {
  if (!(message?.media instanceof Api.MessageMediaDocument)) return undefined;
  const document = message.media.document;
  if (!(document instanceof Api.Document)) return undefined;
  const isSticker = document.attributes.some(
    (attribute) => attribute instanceof Api.DocumentAttributeSticker,
  );
  return isSticker ? document : undefined;
}

/**
 * 원본을 그대로 받아도 되는 스티커인가.
 *
 * **스티커는 썸네일이 아니라 원본을 그려야 한다.** 텔레그램이 주는 스티커 썸네일은 대개
 * 128px 라, 화면에서 220px 로 늘리면 뿌옇게 뭉개진다. 앱들이 또렷한 이유는 512px 짜리 원본을
 * 쓰기 때문이다.
 *
 * 사진과 달리 그래도 되는 이유는 **작아서**다. 정적 스티커는 보통 20~80KB 로, 사진 원본이
 * 몇 MB 씩 나가는 것과 자릿수가 다르다.
 *
 * 다만 브라우저가 `<img>` 로 그릴 수 있는 것만 해당한다. 움직이는 스티커는 Lottie(TGS)나
 * WebM 이라 그대로는 못 그리므로 썸네일로 물러난다.
 */
const STICKER_MAX_BYTES = 512 * 1024;

function renderableSticker(message: Api.Message | undefined): Api.Document | undefined {
  const document = stickerDocumentOf(message);
  if (!document || document.mimeType !== 'image/webp') return undefined;
  return Number(document.size) <= STICKER_MAX_BYTES ? document : undefined;
}

/**
 * 받아 둔 사진 썸네일. mediaKey → data URL(없으면 null).
 *
 * 프로필 사진(`lib/profilePhoto.ts`)과 같은 구조다. react-query 를 안 쓰는 이유도 같다 —
 * **요청 예산을 나눠 써야 하는** 작업이라 동시 실행 수를 직접 쥐고 있어야 한다.
 */
/** 메시지에서 미리보기를 가진 알맹이를 꺼낸다. 사진이면 Photo, 스티커·영상이면 Document. */
function mediaFileOf(message: Api.Message | undefined): Api.Photo | Api.Document | undefined {
  if (message?.media instanceof Api.MessageMediaPhoto && message.media.photo instanceof Api.Photo) {
    return message.media.photo;
  }
  if (
    message?.media instanceof Api.MessageMediaDocument &&
    message.media.document instanceof Api.Document
  ) {
    return message.media.document;
  }
  return undefined;
}

const cache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

/**
 * 동시에 받을 사진 수.
 *
 * 사진 하나가 요청 하나다. 대화를 스크롤하면 화면에 수십 장이 스쳐 가는데 그대로 다 쏘면
 * FLOOD_WAIT 을 맞는다. 아바타(3)보다 조금 넉넉하게 두되 여전히 좁게 잡는다 — 사진은
 * 아바타보다 크고 오래 걸린다.
 */
const CONCURRENCY = 2;

let active = 0;
const queue: (() => void)[] = [];

function pump() {
  while (active < CONCURRENCY && queue.length > 0) {
    active += 1;
    queue.shift()!();
  }
}

export function subscribeMediaThumbs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLoadedThumb(key: string): string | null | undefined {
  return cache.get(key);
}

/**
 * 크게 볼 때 쓰는 판. 목록용 썸네일과 따로 캐시한다.
 *
 * 텔레그램이 가진 가장 큰 `PhotoSize` 를 받는다 — 보통 1280px 남짓이라 화면에서 볼 만하고,
 * 원본 파일(수 MB)까지 갈 필요는 없다. **열었을 때만** 받으므로 목록을 훑는 동안에는
 * 요청이 나가지 않는다.
 */
const fullCache = new Map<string, string | null>();
const fullInFlight = new Map<string, Promise<string | null>>();

export function getLoadedFull(key: string): string | null | undefined {
  return fullCache.get(key);
}

export function loadFullPhoto(key: string): Promise<string | null> {
  const cached = fullCache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = fullInFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    let result: string | null = null;
    try {
      const message = getCachedMediaMessage(key);
      const file = mediaFileOf(message);
      const sizes =
        file instanceof Api.Photo ? file.sizes : file instanceof Api.Document ? (file.thumbs ?? []) : [];
      const largest = sizes
        .filter((size): size is Api.PhotoSize => size instanceof Api.PhotoSize)
        .sort((a, b) => a.w - b.w)
        .pop();
      if (message && largest) {
        const buffer = await requireClient().downloadMedia(message, { thumb: largest });
        if (buffer && typeof buffer !== 'string' && buffer.length > 0) {
          result = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }
      }
    } catch {
      // 지워졌거나 권한이 없다. null 로 굳혀 재시도를 막는다.
    } finally {
      fullCache.set(key, result);
      fullInFlight.delete(key);
      for (const listener of listeners) listener();
    }
    return result;
  })();

  fullInFlight.set(key, task);
  return task;
}

/**
 * 선명한 썸네일을 받아온다.
 *
 * **원본이 아니라 썸네일이다.** 원본을 받으면 사진 한 장에 몇 MB 씩 나가고, 말풍선 안에서는
 * 그만한 해상도가 보이지도 않는다. 실패하면 `null` 을 굳혀서 재시도를 막는다 — 안 그러면
 * 스크롤할 때마다 실패하는 요청을 계속 쏜다.
 */
export function loadMediaThumb(key: string): Promise<string | null> {
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = inFlight.get(key);
  if (existing) return existing;

  const finish = (value: string | null): string | null => {
    cache.set(key, value);
    inFlight.delete(key);
    for (const listener of listeners) listener();
    return value;
  };

  const task = (async () => {
    const stickerId = stickerIdOf(getCachedMediaMessage(key));

    /*
      영구 캐시는 **큐에 들어가기 전에** 본다. 네트워크 대기열 뒤에 세우면, 이미 가진
      그림을 두고도 다운로드가 끝나기를 기다리게 된다.
    */
    if (stickerId) {
      const stored = await readSticker(stickerId);
      if (stored) return finish(stored);
    }

    // 여기서부터는 진짜 요청이라 동시 실행 수를 지켜야 한다.
    return new Promise<string | null>((resolve) => {
      queue.push(async () => {
        let result: string | null = null;
        try {
          const message = getCachedMediaMessage(key);
          const sticker = renderableSticker(message);

          /*
            스티커는 원본을, 나머지는 썸네일을 받는다. 받는 방법만 다를 뿐 결과는 같은
            data URL 이라 아래 처리는 하나로 묶인다.
          */
          const size = sticker ? undefined : pickThumbSize(mediaFileOf(message));
          if (message && (sticker || size)) {
            const buffer = await requireClient().downloadMedia(
              message,
              sticker ? {} : { thumb: size },
            );
            if (buffer && typeof buffer !== 'string' && buffer.length > 0) {
              // data URL 은 형식을 정확히 밝혀야 한다. WebP 를 jpeg 라고 하면 안 그려진다.
              const mime = sticker ? 'image/webp' : 'image/jpeg';
              result = `data:${mime};base64,${buffer.toString('base64')}`;
              // 스티커만 새로고침 뒤에도 남긴다(stickerCache 주석 참고).
              if (stickerId) void writeSticker(stickerId, result);
            }
          }
        } catch {
          // 지워진 사진이거나 권한이 없는 경우다. null 로 굳혀 재시도를 막는다.
        } finally {
          active -= 1;
          pump();
          resolve(finish(result));
        }
      });
      pump();
    });
  })();

  inFlight.set(key, task);
  return task;
}
