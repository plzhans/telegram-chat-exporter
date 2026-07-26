/**
 * picker 함수만 보충한다.
 *
 * TypeScript 의 `lib.dom` 에는 `FileSystemFileHandle`·`FileSystemDirectoryHandle`·
 * `FileSystemWritableFileStream` 은 이미 들어 있지만 **picker 함수는 아직 없다.** 그래서 그
 * 핸들 타입을 다시 선언하면 내장 타입과 병합돼 오히려 충돌한다. 빠진 것만 얹는다.
 */
interface ShowSaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}

/** 일괄 백업에서 방마다 파일을 담을 폴더를 고를 때 쓴다(단일 내보내기의 파일 선택과 짝). */
interface ShowDirectoryPickerOptions {
  mode?: 'read' | 'readwrite';
}

interface Window {
  showSaveFilePicker?: (options?: ShowSaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  showDirectoryPicker?: (
    options?: ShowDirectoryPickerOptions,
  ) => Promise<FileSystemDirectoryHandle>;
}
