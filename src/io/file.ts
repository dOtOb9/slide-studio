// ファイルの読み書き（Elm でいう Cmd: 外の世界との非同期のやり取り）。
// ここは Model を変えない。読み書きが終わったら、呼び出し側が結果を Msg として送る。
//
// Chrome / Edge では File System Access API を使い、開いたファイルにそのまま上書き保存できる。
// 隣の images/ フォルダの画像も、フォルダへのアクセスを許可してもらえば読み書きできる。
// それ以外のブラウザでは、<input type="file"> で開き、ダウンロードで保存する（画像は埋め込む。io/commands.ts）。

import { checkImageFile, IMAGE_DIR, mimeTypeOf } from '../model/images';

/** File System Access API のうち、ここで使う部分だけの型（TypeScript の標準の型にはまだ無いもの） */
interface FileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }>;
}
interface DirectoryHandle {
  kind: 'directory';
  name: string;
  /** handle がこのフォルダの中にあれば、そこまでの名前の並び（直下なら [ファイル名]）。外なら null */
  resolve(handle: FileHandle): Promise<string[] | null>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
}
interface PickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}
interface DirectoryPickerOptions {
  startIn?: FileHandle;
  mode?: 'read' | 'readwrite';
}
interface FsWindow {
  showOpenFilePicker?: (options?: PickerOptions) => Promise<FileHandle[]>;
  showSaveFilePicker?: (options?: PickerOptions) => Promise<FileHandle>;
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<DirectoryHandle>;
}

const fsWindow = window as unknown as FsWindow;
const PICKER_TYPES = [{ description: 'スライド (HTML)', accept: { 'text/html': ['.html', '.htm'] } }];

/**
 * images/ に画像をファイルとして書けるか（保存先とフォルダの両方を選べるブラウザか）。
 * 書けなければ、保存するときに画像を data URI で埋め込む
 */
export const canWriteImageFiles = Boolean(fsWindow.showSaveFilePicker && fsWindow.showDirectoryPicker);

/**
 * 今開いているファイルのハンドル（上書き保存の宛先）。
 * DOM の外の資源への参照なので Model には入れず、ここに置く
 */
let currentHandle: FileHandle | null = null;

/**
 * 今開いているファイルがあるフォルダのハンドル（images/ の読み書きに使う）。ファイルのハンドルと同じ理由でここに置く。
 * ユーザーが許可したときだけ持つ。別のフォルダのファイルを開いた・保存したら捨てる
 */
let currentDir: DirectoryHandle | null = null;

/** ユーザーがダイアログをキャンセルしたときの例外か */
const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** ファイルやフォルダが無いときの例外か */
const isNotFound = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';

/** file が dir の直下にあるか */
async function isDirectlyIn(dir: DirectoryHandle, file: FileHandle): Promise<boolean> {
  const path = await dir.resolve(file);
  return path !== null && path.length === 1 && path[0] === file.name;
}

/**
 * ファイルを選んで読み込む。キャンセルされたら null。
 *   canReadFolder … 隣の images/ を読みに行けるか（File System Access API で開いたときだけ true）
 *   folderReady   … 前に許可されたフォルダに、開いたファイルがあるか（それなら許可を求めずに images/ を読める）
 */
export async function openFile(): Promise<{
  html: string;
  name: string;
  canReadFolder: boolean;
  folderReady: boolean;
} | null> {
  if (fsWindow.showOpenFilePicker) {
    try {
      const [handle] = await fsWindow.showOpenFilePicker({ types: PICKER_TYPES });
      const html = await (await handle.getFile()).text();
      currentHandle = handle;
      if (currentDir && !(await isDirectlyIn(currentDir, handle))) currentDir = null;
      return { html, name: handle.name, canReadFolder: Boolean(fsWindow.showDirectoryPicker), folderReady: currentDir !== null };
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
  currentDir = null;
  return { html: await file.text(), name: file.name, canReadFolder: false, folderReady: false };
}

/**
 * ファイルのあるフォルダを選ばせ、images/ を読み書きできるようにする。
 * 選んだフォルダが、ファイルのあるフォルダと違えば理由を付けて例外を出す。キャンセルなら null。
 */
async function askFolder(file: FileHandle): Promise<DirectoryHandle | null> {
  if (!fsWindow.showDirectoryPicker) throw new Error('このブラウザではフォルダを選べません');
  let dir: DirectoryHandle;
  try {
    dir = await fsWindow.showDirectoryPicker({ startIn: file, mode: 'readwrite' });
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
  // 別のフォルダを選ばれると、images/ を別の場所に読み書きしてしまうので断る
  if (!(await isDirectlyIn(dir, file))) {
    throw new Error(`「${file.name}」があるフォルダを選んでください（選んだフォルダ: ${dir.name}）`);
  }
  return dir;
}

/**
 * 開いているファイルのフォルダへのアクセスを求める（「フォルダへのアクセスを許可」）。キャンセルなら false。
 * すでに許可されていれば選ばせない（images/ に画像を置いてから押し直したときは、読み直すだけ）
 */
export async function requestFolder(): Promise<boolean> {
  if (!currentHandle) throw new Error('開いたファイルの場所がわかりません');
  if (currentDir) return true;
  const dir = await askFolder(currentHandle);
  if (!dir) return false;
  currentDir = dir;
  return true;
}

/**
 * 許可されたフォルダの images/ から、指定したパスの画像を読む（フォルダが無ければ何も読まない）。
 * 読めなかったもの（無い・画像でない・大きすぎる など）は problems に理由を入れ、ほかの画像は読む。
 * 読んでいる間に別のファイルを開いたら、結果は捨てる（stale = true）
 */
export async function readImageFiles(
  paths: string[],
): Promise<{ images: Record<string, Blob>; problems: string[]; stale: boolean }> {
  const images: Record<string, Blob> = {};
  const problems: string[] = [];
  const dir = currentDir;
  const file = currentHandle;
  if (!dir || paths.length === 0) return { images, problems, stale: false };

  let imageDir: DirectoryHandle;
  try {
    imageDir = await dir.getDirectoryHandle(IMAGE_DIR);
  } catch (e) {
    if (!isNotFound(e)) throw e;
    return { images, problems: [`${IMAGE_DIR}/ フォルダがありません`], stale: currentHandle !== file };
  }
  for (const path of paths) {
    const name = path.slice(IMAGE_DIR.length + 1); // パスは model/images.ts の isImagePath で確かめ済み（images/ 直下の1ファイル）
    try {
      const value: unknown = await (await imageDir.getFileHandle(name)).getFile();
      const problem = checkImageFile(value);
      if (problem) {
        problems.push(`${path}: ${problem}`);
        continue;
      }
      // 型が空のとき（ブラウザが拡張子から決められなかった）のために、拡張子から決めた型を付け直す
      const blob = value as File;
      images[path] = blob.type ? blob : new Blob([blob], { type: mimeTypeOf(path) ?? '' });
    } catch (e) {
      problems.push(`${path}: ${isNotFound(e) ? '見つかりません' : String(e)}`);
    }
  }
  return { images, problems, stale: currentHandle !== file };
}

/** フォルダの images/ に画像を書く。同じ名前のファイルがあれば書かない（名前が中身から決まるため） */
async function writeImageFiles(dir: DirectoryHandle, images: Record<string, Blob>) {
  const imageDir = await dir.getDirectoryHandle(IMAGE_DIR, { create: true });
  for (const [path, blob] of Object.entries(images)) {
    const name = path.slice(IMAGE_DIR.length + 1);
    try {
      await imageDir.getFileHandle(name);
      continue; // すでにある
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
    const writable = await (await imageDir.getFileHandle(name, { create: true })).createWritable();
    await writable.write(blob);
    await writable.close();
  }
}

/**
 * 保存する。保存したファイル名と、隣のフォルダを読めるかを返す（キャンセルされたら null）。
 *   saveAs = false … 開いたファイルがあれば上書き。無ければ「名前を付けて保存」になる
 *   saveAs = true  … 常に保存先を選ばせる
 *   images … images/ に書く画像（canWriteImageFiles のときだけ渡す）。
 *            1つでもあればフォルダが要るので、まだ許可されていなければフォルダを選ばせる。画像を先に書き、最後に HTML を書く
 */
export async function saveFile(
  html: string,
  name: string,
  saveAs: boolean,
  images: Record<string, Blob> = {},
): Promise<{ name: string; canReadFolder: boolean } | null> {
  if (fsWindow.showSaveFilePicker) {
    try {
      const target =
        saveAs || !currentHandle
          ? await fsWindow.showSaveFilePicker({ suggestedName: name, types: PICKER_TYPES })
          : currentHandle;
      // 許可済みのフォルダは、保存先がその直下にあるときだけ使う（名前を付けて別のフォルダに保存したら捨てる）
      let dir = currentDir && (await isDirectlyIn(currentDir, target)) ? currentDir : null;
      if (Object.keys(images).length > 0) {
        dir ??= await askFolder(target);
        // フォルダを選ばなかったら保存しない（画像の無い deck.html にならないように）
        if (!dir) return null;
        await writeImageFiles(dir, images);
      }
      const writable = await target.createWritable();
      await writable.write(html);
      await writable.close();
      currentHandle = target;
      currentDir = dir;
      return { name: target.name, canReadFolder: Boolean(fsWindow.showDirectoryPicker) };
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
  return { name, canReadFolder: false };
}
