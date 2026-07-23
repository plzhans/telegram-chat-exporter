/**
 * 스티커 그림을 새로고침 뒤에도 남기는 저장소.
 *
 * ## 왜 스티커만인가
 *
 * 이 앱은 "아무것도 저장하지 않는다"를 신뢰의 근거로 삼는다. 그 원칙을 스티커에만 푸는 데는
 * 이유가 있다.
 *
 * - **스티커는 개인 정보가 아니다.** 텔레그램 전체가 공유하는 자산이고, 파일 id 도 전역
 *   공용 값이다. 누가 언제 무엇을 보냈는지는 여기 남지 않는다 — **그림 자체만** 남는다.
 * - **매번 다시 받기에는 비싸다.** 스티커 파일은 대화방과 **다른 데이터센터**에 있어서,
 *   첫 다운로드마다 그 DC 로 인증을 새로 내보내야 한다(GramJS `_borrowExportedSender`).
 *   새로고침할 때마다 그 왕복을 되풀이하면 스티커가 한참 빈칸으로 남는다.
 *
 * 대화 사진은 **저장하지 않는다.** 그건 대화 내용 그 자체다.
 *
 * ## 얼마나 쌓이나 — 개수가 아니라 바이트로 막는다
 *
 * 처음에는 개수(500개)로 막았는데, 스티커를 썸네일이 아니라 **원본**으로 받도록 바꾸면서
 * 한 개의 크기가 5~15KB 에서 27~107KB 로 뛰었다(base64 는 원본 바이트의 4/3 이다).
 * 개수가 같아도 실제 용량은 몇 배가 될 수 있으니, **실제로 차지하는 바이트**를 세어 막는다.
 *
 * 브라우저가 정해 둔 몫을 넘기면 저장이 실패하는 데서 그치지 않고, 어떤 브라우저는 이 앱의
 * 저장분을 통째로 버린다. 스티커는 다시 받으면 그만이라 **먼저 스스로 버리는 편**이 낫다.
 *
 * 사파리는 몇 주 쓰지 않으면 알아서 지운다(ITP). 그래도 문제는 없다 — 없으면 다시 받는다.
 */
const DB_NAME = 'telegram-chat-exporter';
const STORE = 'stickers';
const META = 'meta';
const TOTAL_KEY = 'totalBytes';
const VERSION = 3;

/**
 * 담아 둘 최대 용량.
 *
 * 20MB 면 실제로 마주치는 스티커 수백 개를 담고도 남으면서, 브라우저 몫(보통 수백 MB 이상)에
 * 견줘 눈에 띄지 않는 크기다. 넘으면 16MB 까지 줄인다 — 한 개 넘칠 때마다 지우면 정리 비용이
 * 매번 들어서, 한 번에 여유를 만들어 둔다.
 */
const MAX_BYTES = 20 * 1024 * 1024;
const PRUNE_TO_BYTES = 16 * 1024 * 1024;

interface StickerRecord {
  id: string;
  dataUrl: string;
  /** 이 항목이 차지하는 바이트. 지울 때 총량에서 빼려면 값마다 들고 있어야 한다. */
  bytes: number;
  /** 마지막으로 쓴 시각. 오래 안 쓴 것부터 버리는 기준이다. */
  usedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | undefined;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    /*
      IndexedDB 가 아예 없거나 막혀 있을 수 있다 — 오래된 브라우저, 사생활 보호 모드,
      기업에서 정책으로 끈 경우. **그때는 캐시 없이 돌면 그만이다.** 스티커는 매번 다시
      받으면 되고, 이 앱의 어떤 기능도 저장소에 기대고 있지 않다.
    */
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        // 버려도 되는 캐시라, 구조가 바뀌면 다시 만든다.
        if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
        if (db.objectStoreNames.contains(META)) db.deleteObjectStore(META);
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        // 오래된 것부터 훑으려면 색인이 필요하다. 전부 읽어 정렬하면 지울 때마다 다 꺼내야 한다.
        store.createIndex('usedAt', 'usedAt');
        db.createObjectStore(META);
      };
      request.onsuccess = () => resolve(request.result);
      // 사생활 보호 모드 등에서 IndexedDB 가 막혀 있을 수 있다. 없으면 없는 대로 돈다.
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** 저장소 키는 텔레그램이 파일에 붙인 전역 id 라 계정과 무관하다. */
export async function readSticker(id: string): Promise<string | undefined> {
  const db = await openDatabase();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result as StickerRecord | undefined;
        if (!record) return resolve(undefined);
        // 쓸 때마다 시각을 갱신한다. 자주 쓰는 스티커가 먼저 버려지면 안 된다.
        store.put({ ...record, usedAt: Date.now() });
        resolve(record.dataUrl);
      };
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function writeSticker(id: string, dataUrl: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const transaction = db.transaction([STORE, META], 'readwrite');
    const store = transaction.objectStore(STORE);
    const meta = transaction.objectStore(META);
    const bytes = dataUrl.length;

    // 같은 스티커를 다시 쓰는 경우가 있다. 그때는 차이만 더해야 총량이 어긋나지 않는다.
    const existing = store.get(id);
    existing.onsuccess = () => {
      const previous = (existing.result as StickerRecord | undefined)?.bytes ?? 0;
      store.put({ id, dataUrl, bytes, usedAt: Date.now() } satisfies StickerRecord);

      const totalRequest = meta.get(TOTAL_KEY);
      totalRequest.onsuccess = () => {
        let total = (typeof totalRequest.result === 'number' ? totalRequest.result : 0) - previous + bytes;
        if (total <= MAX_BYTES) {
          meta.put(total, TOTAL_KEY);
          return;
        }

        // 넘쳤다. 오래 안 쓴 것부터 목표치까지 버린다.
        const cursorRequest = store.index('usedAt').openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor || total <= PRUNE_TO_BYTES) {
            meta.put(total, TOTAL_KEY);
            return;
          }
          const record = cursor.value as StickerRecord;
          // 방금 넣은 것은 남긴다. 지우면 바로 다시 받게 된다.
          if (record.id !== id) {
            total -= record.bytes;
            cursor.delete();
          }
          cursor.continue();
        };
      };
    };
  } catch {
    /* 저장 실패는 치명적이지 않다. 다음에 다시 받으면 된다. */
  }
}

/** 지금 얼마나 쓰고 있는지. 진단용이라 실패하면 0 으로 본다. */
export async function stickerCacheBytes(): Promise<number> {
  const db = await openDatabase();
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(META, 'readonly').objectStore(META).get(TOTAL_KEY);
      request.onsuccess = () => resolve(typeof request.result === 'number' ? request.result : 0);
      request.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

/** 로그아웃할 때 비운다. */
export async function clearStickers(): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const transaction = db.transaction([STORE, META], 'readwrite');
    transaction.objectStore(STORE).clear();
    transaction.objectStore(META).put(0, TOTAL_KEY);
  } catch {
    /* 위와 같다. */
  }
}
