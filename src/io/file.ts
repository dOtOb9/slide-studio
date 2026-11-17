import { checkImageFile, IMAGE_DIR, mimeTypeOf, type SaveDestination } from '../model/images';

interface FileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }>;
}
interface DirectoryHandle {
  kind: 'directory';
  name: string;
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
interface WindowWithFileSystemAccessApiMissingFromTsLib {
  showOpenFilePicker?: (options?: PickerOptions) => Promise<FileHandle[]>;
  showSaveFilePicker?: (options?: PickerOptions) => Promise<FileHandle>;
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<DirectoryHandle>;
}

const fsWindow = window as unknown as WindowWithFileSystemAccessApiMissingFromTsLib;
const PICKER_TYPES = [{ description: 'スライド (HTML)', accept: { 'text/html': ['.html', '.htm'] } }];

const canWriteImageFiles = Boolean(fsWindow.showSaveFilePicker && fsWindow.showDirectoryPicker);

let overwriteTargetOutsideModel: FileHandle | null = null;

let grantedFolderOfOpenedFile: DirectoryHandle | null = null;

const isUserCancel = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

const isNotFound = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';

const fileNameInImageDir = (checkedImagePath: string) => checkedImagePath.slice(IMAGE_DIR.length + 1);

const SOMEWHERE_ELSE: SaveDestination = { overwritesOpenedFile: false, directlyInGrantedFolder: false };

async function isDirectlyIn(dir: DirectoryHandle, file: FileHandle): Promise<boolean> {
  const path = await dir.resolve(file);
  return path !== null && path.length === 1 && path[0] === file.name;
}

function switchOpenedFileOnlyAfterAllAwaitsSucceeded(handle: FileHandle, keepGrantedFolder: boolean) {
  overwriteTargetOutsideModel = handle;
  if (!keepGrantedFolder) grantedFolderOfOpenedFile = null;
}

export async function openFile(): Promise<{
  html: string;
  name: string;
  canReadFolder: boolean;
  folderAlreadyGranted: boolean;
} | null> {
  if (fsWindow.showOpenFilePicker) {
    try {
      const [handle] = await fsWindow.showOpenFilePicker({ types: PICKER_TYPES });
      const html = await (await handle.getFile()).text();
      const keepGrantedFolder = grantedFolderOfOpenedFile !== null && (await isDirectlyIn(grantedFolderOfOpenedFile, handle));
      switchOpenedFileOnlyAfterAllAwaitsSucceeded(handle, keepGrantedFolder);
      return { html, name: handle.name, canReadFolder: Boolean(fsWindow.showDirectoryPicker), folderAlreadyGranted: grantedFolderOfOpenedFile !== null };
    } catch (e) {
      if (isUserCancel(e)) return null;
      throw e;
    }
  }
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return null;
  overwriteTargetOutsideModel = null;
  grantedFolderOfOpenedFile = null;
  return { html: await file.text(), name: file.name, canReadFolder: false, folderAlreadyGranted: false };
}

async function askFolder(file: FileHandle): Promise<DirectoryHandle | null> {
  if (!fsWindow.showDirectoryPicker) throw new Error('このブラウザではフォルダを選べません');
  let dir: DirectoryHandle;
  try {
    dir = await fsWindow.showDirectoryPicker({ startIn: file, mode: 'readwrite' });
  } catch (e) {
    if (isUserCancel(e)) return null;
    throw e;
  }
  const otherFolderWouldReadAndWriteWrongImages = !(await isDirectlyIn(dir, file));
  if (otherFolderWouldReadAndWriteWrongImages) {
    throw new Error(`「${file.name}」があるフォルダを選んでください（選んだフォルダ: ${dir.name}）`);
  }
  return dir;
}

export async function requestFolder(): Promise<boolean> {
  if (!overwriteTargetOutsideModel) throw new Error('開いたファイルの場所がわかりません');
  if (grantedFolderOfOpenedFile) return true;
  const dir = await askFolder(overwriteTargetOutsideModel);
  if (!dir) return false;
  grantedFolderOfOpenedFile = dir;
  return true;
}

export async function readImageFiles(
  paths: string[],
): Promise<{ images: Record<string, Blob>; problems: string[]; openedAnotherFileWhileReading: boolean }> {
  const images: Record<string, Blob> = {};
  const problems: string[] = [];
  const dir = grantedFolderOfOpenedFile;
  const file = overwriteTargetOutsideModel;
  if (!dir || paths.length === 0) return { images, problems, openedAnotherFileWhileReading: false };

  let imageDir: DirectoryHandle;
  try {
    imageDir = await dir.getDirectoryHandle(IMAGE_DIR);
  } catch (e) {
    if (!isNotFound(e)) throw e;
    return { images, problems: [`${IMAGE_DIR}/ フォルダがありません`], openedAnotherFileWhileReading: overwriteTargetOutsideModel !== file };
  }
  for (const path of paths) {
    try {
      const value: unknown = await (await imageDir.getFileHandle(fileNameInImageDir(path))).getFile();
      const problem = checkImageFile(value);
      if (problem) {
        problems.push(`${path}: ${problem}`);
        continue;
      }
      images[path] = withTypeFromExtensionIfBrowserLeftItEmpty(value as File, path);
    } catch (e) {
      problems.push(`${path}: ${isNotFound(e) ? '見つかりません' : String(e)}`);
    }
  }
  return { images, problems, openedAnotherFileWhileReading: overwriteTargetOutsideModel !== file };
}

function withTypeFromExtensionIfBrowserLeftItEmpty(file: File, path: string): Blob {
  return file.type ? file : new Blob([file], { type: mimeTypeOf(path) ?? '' });
}

async function exists(dir: DirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch (e) {
    if (!isNotFound(e)) throw e;
    return false;
  }
}

async function writeImageFilesSkippingExistingSinceNameIsContentHash(dir: DirectoryHandle, images: Record<string, Blob>) {
  const imageDir = await dir.getDirectoryHandle(IMAGE_DIR, { create: true });
  for (const [path, blob] of Object.entries(images)) {
    const name = fileNameInImageDir(path);
    if (await exists(imageDir, name)) continue;
    const writable = await (await imageDir.getFileHandle(name, { create: true })).createWritable();
    await writable.write(blob);
    await writable.close();
  }
}

async function writeImagesForSave(
  target: FileHandle,
  dir: DirectoryHandle | null,
  images: Record<string, Blob>,
): Promise<{ written: boolean; dir: DirectoryHandle | null }> {
  try {
    dir ??= await askFolder(target);
    if (!dir) {
      console.warn('フォルダが選ばれなかったので、画像を deck.html に埋め込みます');
      return { written: false, dir: null };
    }
    await writeImageFilesSkippingExistingSinceNameIsContentHash(dir, images);
    return { written: true, dir };
  } catch (e) {
    console.warn('images/ に画像を書けなかったので、deck.html に埋め込みます', e);
    return { written: false, dir };
  }
}

export async function saveFile(
  name: string,
  saveAs: boolean,
  images: Record<string, Blob>,
  html: (imagesWrittenToFolder: boolean) => Promise<string>,
  proceed: (dest: SaveDestination) => boolean,
): Promise<{ name: string; canReadFolder: boolean; embedded: boolean } | null> {
  if (fsWindow.showSaveFilePicker) {
    try {
      const showsPicker = saveAs || !overwriteTargetOutsideModel;
      const grantedBeforePicker = grantedFolderOfOpenedFile;
      const askBeforePickerSinceBrowserCreatesFileOnPick = showsPicker && !grantedBeforePicker;
      if (askBeforePickerSinceBrowserCreatesFileOnPick && !proceed(SOMEWHERE_ELSE)) return null;
      const target =
        saveAs || !overwriteTargetOutsideModel
          ? await fsWindow.showSaveFilePicker({ suggestedName: name, types: PICKER_TYPES })
          : overwriteTargetOutsideModel;
      const directlyInGrantedFolder = grantedBeforePicker !== null && (await isDirectlyIn(grantedBeforePicker, target));
      const destinationKnownOnlyAfterPicker = !askBeforePickerSinceBrowserCreatesFileOnPick;
      if (destinationKnownOnlyAfterPicker && !proceed({ overwritesOpenedFile: !showsPicker, directlyInGrantedFolder })) return null;
      let folderForTarget = directlyInGrantedFolder ? grantedBeforePicker : null;
      let imagesWrittenToFolder = true;
      let embeddedSoUserShouldBeTold = false;
      if (Object.keys(images).length > 0) {
        if (canWriteImageFiles) {
          const result = await writeImagesForSave(target, folderForTarget, images);
          folderForTarget = result.dir;
          imagesWrittenToFolder = result.written;
          embeddedSoUserShouldBeTold = !result.written;
        } else {
          imagesWrittenToFolder = false;
        }
      }
      const htmlWrittenLastEvenIfImagesFailed = await html(imagesWrittenToFolder);
      const writable = await target.createWritable();
      await writable.write(htmlWrittenLastEvenIfImagesFailed);
      await writable.close();
      overwriteTargetOutsideModel = target;
      grantedFolderOfOpenedFile = folderForTarget;
      return {
        name: target.name,
        canReadFolder: Boolean(fsWindow.showDirectoryPicker),
        embedded: embeddedSoUserShouldBeTold,
      };
    } catch (e) {
      if (isUserCancel(e)) return null;
      throw e;
    }
  }
  const downloadCountsAsSomewhereElse = SOMEWHERE_ELSE;
  if (!proceed(downloadCountsAsSomewhereElse)) return null;
  const url = URL.createObjectURL(new Blob([await html(false)], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return { name, canReadFolder: false, embedded: false };
}
