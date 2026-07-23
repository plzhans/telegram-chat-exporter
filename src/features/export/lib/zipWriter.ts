import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';

/**
 * 압축된 바이트가 흘러갈 곳.
 *
 * 두 구현이 있다. 디스크로 바로 흘려보내는 쪽(`createFileSink`)과, 다 모아서 마지막에
 * 한 번에 내려받는 쪽(`createMemorySink`). 전자는 큰 대화방에서 메모리 한계가 없고
 * 후자는 어디서나 동작한다.
 */
export interface ZipSink {
  write(chunk: Uint8Array): Promise<void>;
  /** 정상 종료. 파일을 닫거나 다운로드를 띄운다. */
  finish(): Promise<void>;
  /** 중단. 만들다 만 파일을 정리한다. */
  abort(): Promise<void>;
  /**
   * 실제로 저장된 파일 이름.
   *
   * **경로는 알 수 없다.** File System Access API 는 보안상 전체 경로를 알려주지 않고
   * 파일 이름만 준다. 사용자가 저장 대화상자에서 이름을 바꿨다면 그 바뀐 이름이다.
   */
  readonly name: string;
  /** `picked` = 사용자가 위치를 고름, `download` = 브라우저 기본 다운로드 폴더로 감. */
  readonly kind: 'picked' | 'download';
}

/**
 * File System Access API 로 디스크에 직접 쓴다.
 *
 * **반드시 사용자 클릭 핸들러 안에서 만들어야 한다.** `showSaveFilePicker` 는 사용자 제스처를
 * 요구하는데, 내보내기가 시작된 뒤(await 를 여러 번 건넌 뒤)에 부르면 제스처가 이미 소진돼
 * `NotAllowedError` 로 거절당한다.
 *
 * 지원하지 않는 브라우저(파이어폭스·사파리)에서는 null 을 돌려준다.
 */
export type FileSinkResult =
  | { status: 'ok'; sink: ZipSink }
  /** 이 브라우저에 File System Access API 가 없다. 메모리 방식으로 떨어져야 한다. */
  | { status: 'unsupported' }
  /** 사용자가 저장 대화상자를 닫았다. **아무것도 하지 말아야 한다.** */
  | { status: 'cancelled' };

export async function createFileSink(filename: string): Promise<FileSinkResult> {
  const picker = window.showSaveFilePicker;
  if (!picker) return { status: 'unsupported' };

  let handle: FileSystemFileHandle;
  try {
    handle = await picker({
      suggestedName: filename,
      types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }],
    });
  } catch {
    /**
     * 취소를 "지원 안 함"과 **구분해야 한다.** 예전에는 둘 다 null 로 돌려줘서, 저장
     * 대화상자에서 취소를 눌러도 메모리 방식으로 떨어져 다운로드가 그대로 진행됐다.
     * 취소는 "하지 마라"는 뜻이다.
     */
    return { status: 'cancelled' };
  }

  const stream = await handle.createWritable();
  const sink: ZipSink = {
    // 사용자가 대화상자에서 이름을 바꿨을 수 있으니 우리가 제안한 값이 아니라 실제 값을 쓴다.
    name: handle.name,
    kind: 'picked',
    /**
     * 캐스팅이 필요한 이유: TS 5.7 부터 `Uint8Array` 가 버퍼 종류로 제네릭해져서
     * `Uint8Array<ArrayBufferLike>` 는 `SharedArrayBuffer` 일 수도 있다고 본다. fflate 는
     * 항상 평범한 `ArrayBuffer` 기반 배열을 주므로 실제로는 안전하다.
     */
    write: (chunk) => stream.write(chunk as unknown as FileSystemWriteChunkType),
    finish: () => stream.close(),
    abort: () => stream.abort(),
  };
  return { status: 'ok', sink };
}

/** Blob 으로 모았다가 마지막에 내려받는다. File System Access API 가 없을 때의 대안. */
/**
 * 조각을 Blob 으로 접어 넘기는 단위.
 *
 * 조각마다 접으면 Blob 객체가 수만 개 생기고, 안 접으면 자바스크립트 힙에 다 쌓인다.
 * 8MB 면 힙에 머무는 양이 늘 그 아래이면서 접는 횟수도 감당할 만하다.
 */
const FOLD_THRESHOLD = 8 * 1024 * 1024;

export function createMemorySink(filename: string): ZipSink {
  /*
    **자바스크립트 힙에 zip 전체를 쥐고 있지 않는다.**

    예전에는 `Uint8Array[]` 에 끝까지 모았다가 마지막에 Blob 을 만들었다. 그러면 압축된
    바이트가 통째로 힙에 앉아 있어서, 큰 대화방에서는 탭이 죽는다 - 특히 메모리가 넉넉하지
    않은 휴대전화에서.

    대신 일정량이 모일 때마다 **Blob 안으로 접어 넘긴다.** `new Blob([blob, ...])` 은 앞선
    Blob 의 내용을 힙으로 다시 끌어오지 않고 참조만 이어 붙이며, 브라우저는 그 저장소를
    필요하면 디스크로 내린다. 그래서 힙에 머무는 양이 FOLD_THRESHOLD 아래로 유지된다.

    크롬처럼 파일에 바로 쓰는 것과 같지는 않다 - 그건 애초에 우리 손을 거치지 않는다.
    여기서는 "힙에 다 쌓지는 않는다" 까지가 할 수 있는 전부다.
  */
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let blob = new Blob([], { type: 'application/zip' });

  const fold = () => {
    if (pendingBytes === 0) return;
    blob = new Blob([blob, ...(pending as BlobPart[])], { type: 'application/zip' });
    pending = [];
    pendingBytes = 0;
  };

  const discard = () => {
    pending = [];
    pendingBytes = 0;
    blob = new Blob([]);
  };

  return {
    name: filename,
    kind: 'download',
    write: async (chunk) => {
      pending.push(chunk);
      pendingBytes += chunk.byteLength;
      if (pendingBytes >= FOLD_THRESHOLD) fold();
    },
    finish: async () => {
      fold();
      downloadBlob(blob, filename);
      discard();
    },
    abort: async () => {
      discard();
    },
  };
}

/**
 * sink 로 흘려보내는 zip 작성기.
 *
 * **Worker 를 쓰지 않는다.** fflate 의 비동기 API(그리고 JSZip)는 Web Worker 를 blob URL 로
 * 만들어 띄우는데, 그러려면 CSP 에 `worker-src blob:` 을 열어야 한다. 이 앱의 신뢰 근거가
 * `default-src 'none'` 이라 그 구멍을 내고 싶지 않다.
 *
 * fflate 의 `ondata` 는 동기 콜백이라 그 안에서 await 를 할 수 없다. 그래서 나온 청크를
 * 일단 대기열에 쌓고, 호출부가 배치 사이에 `drain()` 으로 비운다.
 */
export class ZipWriter {
  private readonly zip: Zip;
  private readonly pending: Uint8Array[] = [];
  private failure: Error | null = null;
  private current: ZipDeflate | ZipPassThrough | null = null;
  private ended = false;
  /** 지금까지 sink 로 내보낸 바이트 수. 진행률 표시에 쓴다. */
  private written = 0;

  constructor(private readonly sink: ZipSink) {
    this.zip = new Zip((err, data, final) => {
      if (err) {
        this.failure = err;
        return;
      }
      this.pending.push(data);
      if (final) this.ended = true;
    });
  }

  get bytesWritten(): number {
    return this.written;
  }

  /** 파일을 하나 열고, 그 파일에 이어 쓸 함수를 돌려준다. */
  startFile(name: string): (text: string, last?: boolean) => void {
    this.throwIfFailed();
    const file = new ZipDeflate(name, { level: 6 });
    this.zip.add(file);
    this.current = file;

    const encoder = new TextEncoder();
    return (text: string, last = false) => {
      this.throwIfFailed();
      file.push(encoder.encode(text), last);
      if (last) this.current = null;
    };
  }

  /** 한 번에 다 쓰는 작은 파일용. */
  writeFile(name: string, text: string): void {
    this.startFile(name)(text, true);
  }

  /**
   * 이미 압축된 바이트를 그대로 담는다.
   *
   * `ZipDeflate` 가 아니라 `ZipPassThrough` 를 쓴다. JPEG·PNG 는 이미 압축된 형식이라 다시
   * 압축해 봐야 **크기는 그대로면서 CPU 만 쓴다.** 사진 수백 장이면 그 낭비가 눈에 띈다.
   */
  writeBinary(name: string, bytes: Uint8Array): void {
    this.throwIfFailed();
    const file = new ZipPassThrough(name);
    this.zip.add(file);
    this.current = file;
    file.push(bytes, true);
    this.current = null;
  }

  /** 대기열에 쌓인 청크를 sink 로 내보낸다. 배치마다 불러 주면 메모리가 안 쌓인다. */
  async drain(): Promise<void> {
    this.throwIfFailed();
    while (this.pending.length > 0) {
      const chunk = this.pending.shift()!;
      await this.sink.write(chunk);
      this.written += chunk.length;
    }
  }

  /** zip 을 닫고 sink 를 마무리한다. 열려 있는 파일이 모두 닫힌 뒤에 불러야 한다. */
  async finish(): Promise<void> {
    if (this.current) throw new Error('닫지 않은 파일이 남아 있습니다.');
    this.zip.end();
    this.throwIfFailed();
    if (!this.ended) throw new Error('zip 이 끝나지 않았습니다.');
    await this.drain();
    await this.sink.finish();
  }

  async abort(): Promise<void> {
    this.pending.length = 0;
    await this.sink.abort();
  }

  private throwIfFailed(): void {
    if (this.failure) throw this.failure;
  }
}

/**
 * Blob 을 파일로 내려받는다.
 *
 * `a[download]` + blob URL 방식이라 네트워크 요청이 아니다 — CSP 의 `connect-src` 와 무관하게
 * 동작한다(프로덕션 빌드에서 `securitypolicyviolation` 이벤트로 확인했다). 다 쓴 URL 은
 * 해제해야 탭이 살아 있는 동안 Blob 이 메모리에 붙잡히지 않는다.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // 클릭 직후 바로 revoke 하면 일부 브라우저에서 다운로드가 취소된다. 한 틱 뒤에 푼다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
