export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/**
 * 밖에서 결과를 채워 넣을 수 있는 Promise.
 *
 * GramJS 인증은 `phoneCode: () => Promise<string>` 처럼 **라이브러리가 우리를 호출하는** 모양이다.
 * 그런데 값은 사용자가 폼을 제출해야 생긴다. 그래서 콜백이 불리는 순간 deferred 를 만들어
 * 스토어에 걸어두고, 폼 제출이 그 deferred 를 resolve 한다.
 */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
