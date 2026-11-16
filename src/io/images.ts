// images/ の画像の中身（Blob）を、ブラウザの機能で扱う道具（Elm でいう Cmd の側）。
// ハッシュの計算・表示用の Blob URL・埋め込み用の data URI。どれも Model は変えない。
// パスの判定などの純粋な部分は model/images.ts にある。

import { imagePath, mimeTypeOf } from '../model/images';
import type { ResolveSrc } from '../model/serialize';

/** Blob の中身の SHA-256 を16進の文字列（64文字）で返す */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 画像の Blob から、置き場所のパス（images/<SHA-256>.<拡張子>）を作る。
 * 拡張子は Blob の MIME 型から決める。対応していない型なら null
 */
export async function imagePathOf(blob: Blob): Promise<string | null> {
  return imagePath(await sha256Hex(blob), blob.type);
}

/**
 * Blob ごとに1回だけ作った Blob URL を覚えておく（描画のたびに作ると、同じ画像で URL が増え続けるため）。
 * Blob URL は解放（revokeObjectURL）しない。表示中の画像の URL を誤って無効にしないことを優先している。
 * そのため、別のファイルを開いて Model.images が空になっても、前の画像の Blob は Blob URL から参照され続け、
 * ページを閉じるまでメモリに残る（承知の上。画像の数が多くなる使い方は想定していない）
 */
const blobUrls = new WeakMap<Blob, string>();

function blobUrl(blob: Blob): string {
  let url = blobUrls.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    blobUrls.set(blob, url);
  }
  return url;
}

/**
 * 表示用の src の解決方法（renderSlideHtml に渡す）。
 * 中身を持っている画像は Blob URL に、持っていない画像はそのままのパスにする（壊れた画像として表示される）
 */
export function displaySrc(images: Record<string, Blob>): ResolveSrc {
  return (path) => {
    const blob = images[path];
    return blob ? blobUrl(blob) : path;
  };
}

/** Blob を data URI（data:<型>;base64,...）にする。型が空なら fallbackType を使う */
function toDataUri(blob: Blob, fallbackType: string): Promise<string> {
  const typed = blob.type ? blob : new Blob([blob], { type: fallbackType });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(typed);
  });
}

/**
 * 埋め込み用の src の解決方法（serializeDeck に渡す）。使っている画像だけを先に data URI にしておく。
 * 中身を持っていない画像は参照（images/...）のまま残す
 */
export async function embedSrc(paths: string[], images: Record<string, Blob>): Promise<ResolveSrc> {
  const uris: Record<string, string> = {};
  for (const path of paths) {
    const blob = images[path];
    if (blob) uris[path] = await toDataUri(blob, mimeTypeOf(path) ?? 'application/octet-stream');
  }
  return (path) => uris[path] ?? path;
}
