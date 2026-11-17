// 受け取ったファイルを挿入できる形にする、部品（view）の側の非同期の処理。
// ボタン（ファイル選択）・貼り付け・ドロップのどれも、最後は insertImageFiles を通る（同じ手順で挿入する）。
//
// ここは Model を変えない。終わった結果を Msg で送るだけ（Elm でいう Cmd の側）:
//   ImagesAdded（中身を Model.images に入れる）→ images/Inserted（要素を置く）の順に送る。
// 判断（どこに・どの大きさで置くか、置いてよい状態か）は update.ts と layout.ts の純粋な関数にある。

import { checkImageFile, extensionOf, imagePathOf, type Msg } from '../../plugin-api';
import type { ImageToInsert, ImagesMsg } from './update';

/** 断ったファイルと理由 */
export interface Rejection {
  name: string;
  reason: string;
}

/**
 * 受け取ったファイルを入れてよいか（外から来る値の入口）。よければ null、だめなら理由。
 * 土台と同じ checkImageFile（File でない・空・画像でない型・50MB 超）に加えて、
 * images/ に置ける MIME 型（png・jpeg・gif・webp・svg・avif）でなければ断る（型が分からないものも断る）
 */
export function rejectReason(file: unknown): string | null {
  const problem = checkImageFile(file);
  if (problem) return problem;
  const type = (file as File).type;
  if (!extensionOf(type)) return `対応していない形式です（${type || '形式が分かりません'}）`;
  return null;
}

/**
 * 画像の元の大きさ（px）を測る。読めない・大きさが 0 の画像なら null。
 * createImageBitmap は SVG を読めないブラウザがあるので、どの形式でも読める <img> で測る
 */
export function measureImage(blob: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const done = (size: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url); // 測るためだけの URL なので、すぐ解放する（表示用の URL は土台が別に作る）
      resolve(size);
    };
    img.onload = () => done(img.naturalWidth > 0 && img.naturalHeight > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => done(null);
    img.src = url;
  });
}

/** 測る・パスを作る関数（テストで差し替えられるように引数にしている） */
export interface PrepareDeps {
  measure: (blob: Blob) => Promise<{ width: number; height: number } | null>;
  pathOf: (blob: Blob) => Promise<string | null>;
}

const defaultDeps: PrepareDeps = { measure: measureImage, pathOf: imagePathOf };

/**
 * ファイルの一覧を、挿入できるもの（中身・パス・元の大きさ）と断ったもの（理由つき）に分ける。
 * 1つが不正でも、ほかのファイルは入れる。並びは受け取った順のまま
 */
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

/** 断ったファイルを知らせる（コンソールと画面）。テストでは差し替える */
export function notifyRejected(rejected: Rejection[]) {
  console.warn('画像を挿入できなかったファイルがあります', rejected);
  window.alert(`次のファイルは挿入できませんでした:\n${rejected.map((r) => `・${r.name}: ${r.reason}`).join('\n')}`);
}

/**
 * ファイルを挿入する（ボタン・貼り付け・ドロップの共通の手順）。
 * 中身を先に ImagesAdded で入れてから、images/Inserted で要素を置く（逆だと、update が中身の無い画像を置かない）。
 * 挿入してよい状態か（スライドがあるか、編集中でないか）は、届いた時点の Model で update が決める
 */
export async function insertImageFiles(
  files: readonly unknown[],
  dispatch: (msg: Msg) => void,
  deps: PrepareDeps = defaultDeps,
  notify: (rejected: Rejection[]) => void = notifyRejected,
): Promise<void> {
  const { ready, rejected } = await prepareImages(files, deps);
  if (ready.length > 0) {
    dispatch({ type: 'ImagesAdded', images: Object.fromEntries(ready.map((r) => [r.image.path, r.blob])) });
    const msg: ImagesMsg = { type: 'images/Inserted', images: ready.map((r) => r.image) };
    dispatch(msg);
  }
  if (rejected.length > 0) notify(rejected);
}
