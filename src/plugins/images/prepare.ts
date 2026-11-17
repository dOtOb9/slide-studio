import { checkImageFile, extensionOf, imagePathOf, type Msg } from '../../plugin-api';
import type { ImageToInsert, ImagesMsg } from './update';

export interface Rejection {
  name: string;
  reason: string;
}

export function rejectReason(file: unknown): string | null {
  const problem = checkImageFile(file);
  if (problem) return problem;
  const type = (file as File).type;
  if (!extensionOf(type)) return `対応していない形式です（${type || '形式が分かりません'}）`;
  return null;
}

function imgElementBecauseCreateImageBitmapCannotReadSvgInSomeBrowsers(): HTMLImageElement {
  return new Image();
}

export function measureImage(blob: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const urlOnlyForMeasuring = URL.createObjectURL(blob);
    const img = imgElementBecauseCreateImageBitmapCannotReadSvgInSomeBrowsers();
    const done = (size: { width: number; height: number } | null) => {
      URL.revokeObjectURL(urlOnlyForMeasuring);
      resolve(size);
    };
    img.onload = () => done(img.naturalWidth > 0 && img.naturalHeight > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => done(null);
    img.src = urlOnlyForMeasuring;
  });
}

export interface PrepareDeps {
  measure: (blob: Blob) => Promise<{ width: number; height: number } | null>;
  pathOf: (blob: Blob) => Promise<string | null>;
}

const defaultDeps: PrepareDeps = { measure: measureImage, pathOf: imagePathOf };

export async function prepareImages(
  files: readonly unknown[],
  deps: PrepareDeps = defaultDeps,
): Promise<{ ready: { blob: Blob; image: ImageToInsert }[]; rejected: Rejection[] }> {
  const results = await Promise.all(
    files.map(async (file): Promise<Rejection | { blob: Blob; image: ImageToInsert }> => {
      const name = file instanceof File ? file.name || '（名前なし）' : String(file);
      const reason = rejectReason(file);
      if (reason) return { name, reason };
      const blob = file as File;
      try {
        const [size, path] = await Promise.all([deps.measure(blob), deps.pathOf(blob)]);
        if (!size) return { name, reason: '画像として読めません（大きさを測れません）' };
        if (!path) return { name, reason: '対応していない形式です' };
        return { blob, image: { path, width: size.width, height: size.height } };
      } catch (e) {
        return { name, reason: `読めませんでした（${e instanceof Error ? e.message : String(e)}）` };
      }
    }),
  );
  const ready: { blob: Blob; image: ImageToInsert }[] = [];
  const rejected: Rejection[] = [];
  for (const r of results) {
    if ('reason' in r) rejected.push(r);
    else ready.push(r);
  }
  return { ready, rejected };
}

export function notifyRejected(rejected: Rejection[]) {
  console.warn('画像を挿入できなかったファイルがあります', rejected);
  window.alert(`次のファイルは挿入できませんでした:\n${rejected.map((r) => `・${r.name}: ${r.reason}`).join('\n')}`);
}

export async function insertImageFiles(
  files: readonly unknown[],
  dispatch: (msg: Msg) => void,
  deps: PrepareDeps = defaultDeps,
  notify: (rejected: Rejection[]) => void = notifyRejected,
): Promise<void> {
  const { ready, rejected } = await prepareImages(files, deps);
  if (ready.length > 0) {
    const contentsFirstSinceUpdateSkipsImagesWithoutContents = {
      type: 'ImagesAdded' as const,
      images: Object.fromEntries(ready.map((r) => [r.image.path, r.blob])),
    };
    dispatch(contentsFirstSinceUpdateSkipsImagesWithoutContents);
    const msg: ImagesMsg = { type: 'images/Inserted', images: ready.map((r) => r.image) };
    dispatch(msg);
  }
  if (rejected.length > 0) notify(rejected);
}
