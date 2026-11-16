// ファイルの読み書き（Elm でいう Cmd: 外の世界との非同期のやり取り）。
// ここは Model を変えない。読み書きが終わったら、呼び出し側が結果を Msg として送る。
//
// Chrome / Edge では File System Access API を使い、開いたファイルにそのまま上書き保存できる。
// それ以外のブラウザでは、<input type="file"> で開き、ダウンロードで保存する。

/** File System Access API のうち、ここで使う部分だけの型（TypeScript の標準の型にはまだ無いもの） */
interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
interface PickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}
interface FsWindow {
  showOpenFilePicker?: (options?: PickerOptions) => Promise<FileHandle[]>;
  showSaveFilePicker?: (options?: PickerOptions) => Promise<FileHandle>;
}

const fsWindow = window as unknown as FsWindow;
const PICKER_TYPES = [{ description: 'スライド (HTML)', accept: { 'text/html': ['.html', '.htm'] } }];

/**
 * 今開いているファイルのハンドル（上書き保存の宛先）。
 * DOM の外の資源への参照なので Model には入れず、ここに置く
 */
let currentHandle: FileHandle | null = null;

/** ユーザーがダイアログをキャンセルしたときの例外か */
const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** ファイルを選んで読み込む。キャンセルされたら null */
export async function openFile(): Promise<{ html: string; name: string } | null> {
  if (fsWindow.showOpenFilePicker) {
    try {
      const [handle] = await fsWindow.showOpenFilePicker({ types: PICKER_TYPES });
      currentHandle = handle;
      return { html: await (await handle.getFile()).text(), name: handle.name };
    } catch (e) {
      if (isAbort(e)) return null;
      throw e;
    }
  }
  // File System Access API が無いブラウザ: 一時的な <input type="file"> で選ばせる
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return null;
  currentHandle = null;
  return { html: await file.text(), name: file.name };
}

/**
 * 保存する。保存したファイル名を返す（キャンセルされたら null）。
 *   saveAs = false … 開いたファイルがあれば上書き。無ければ「名前を付けて保存」になる
 *   saveAs = true  … 常に保存先を選ばせる
 */
export async function saveFile(html: string, name: string, saveAs: boolean): Promise<string | null> {
  if (fsWindow.showSaveFilePicker) {
    try {
      if (saveAs || !currentHandle) {
        currentHandle = await fsWindow.showSaveFilePicker({ suggestedName: name, types: PICKER_TYPES });
      }
      const writable = await currentHandle.createWritable();
      await writable.write(html);
      await writable.close();
      return currentHandle.name;
    } catch (e) {
      if (isAbort(e)) return null;
      throw e;
    }
  }
  // File System Access API が無いブラウザ: ダウンロードとして保存する
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return name;
}
