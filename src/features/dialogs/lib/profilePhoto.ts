import { requireClient } from '@/shared/auth/useAuth';
import { getCachedPeer } from '../api';

/**
 * 이미 받아 둔 선명한 프로필 사진. peer id → data URL.
 *
 * react-query 를 안 쓰고 직접 캐시를 두는 이유는, 이게 **요청 예산을 나눠 써야 하는**
 * 작업이기 때문이다. 아래 큐가 동시 실행 수를 직접 조절한다.
 */
const cache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

/**
 * 동시에 진행할 사진 다운로드 수.
 *
 * `downloadProfilePhoto` 는 **대화방 하나당 요청 하나**다. 200개 목록에서 한꺼번에 쏘면
 * FLOOD_WAIT 을 정면으로 맞는다. 화면에 보이는 것만, 그것도 몇 개씩만 받는다.
 */
const CONCURRENCY = 3;

let active = 0;
const queue: (() => void)[] = [];

function pump() {
  while (active < CONCURRENCY && queue.length > 0) {
    active += 1;
    queue.shift()!();
  }
}

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeProfilePhotos(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLoadedPhoto(id: string): string | null | undefined {
  return cache.get(id);
}

/**
 * 선명한 프로필 사진을 받아온다. 이미 받았거나 받는 중이면 그걸 그대로 쓴다.
 *
 * 실패하면 `null` 을 캐시에 남긴다 — 사진이 없는 계정이나 거부된 요청을 **다시 시도하지
 * 않기 위해서다.** 안 그러면 화면에 보일 때마다 실패하는 요청을 계속 쏜다.
 */
export function loadProfilePhoto(id: string): Promise<string | null> {
  const cached = cache.get(id);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = inFlight.get(id);
  if (existing) return existing;

  const task = new Promise<string | null>((resolve) => {
    queue.push(async () => {
      let result: string | null = null;
      try {
        const peer = getCachedPeer(id);
        if (peer) {
          // isBig: false 는 목록용 작은 판(보통 160px). 아바타에는 이걸로 충분하고 훨씬 가볍다.
          const buffer = await requireClient().downloadProfilePhoto(peer, { isBig: false });
          if (buffer && typeof buffer !== 'string' && buffer.length > 0) {
            result = `data:image/jpeg;base64,${buffer.toString('base64')}`;
          }
        }
      } catch {
        // 사진이 없거나 권한이 없는 경우다. null 로 굳혀서 재시도를 막는다.
      } finally {
        cache.set(id, result);
        inFlight.delete(id);
        active -= 1;
        notify();
        pump();
        resolve(result);
      }
    });
    pump();
  });

  inFlight.set(id, task);
  return task;
}
