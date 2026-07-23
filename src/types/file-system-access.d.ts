/**
 * `showSaveFilePicker` 만 보충한다.
 *
 * TypeScript 의 `lib.dom` 에는 `FileSystemFileHandle`·`FileSystemWritableFileStream` 은 이미
 * 들어 있지만 **picker 함수는 아직 없다.** 그래서 그 두 개를 다시 선언하면 내장 타입과
 * 병합돼 오히려 충돌한다. 빠진 하나만 얹는다.
 */
interface ShowSaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}

interface Window {
  showSaveFilePicker?: (options?: ShowSaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}
