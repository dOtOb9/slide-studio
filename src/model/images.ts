// deck.html の隣の images/ に置く画像ファイルの扱い（純粋な関数だけ。React にも DOM にも依存しない）。
//
// 画像は deck.html に埋め込まず、隣のフォルダに普通のファイルとして置き、
//   <img data-el src="images/<中身の SHA-256 の16進>.<拡張子>">
// で参照する（AI が deck.html を読み書きしやすいように）。名前は中身から決まるので、
// 同じ名前なら同じ中身とみなせる（書き込み済みなら書き直さない・増えるだけで消さない）。
//
// 管理の対象は「section 直下の img 要素の src が images/ で始まるもの」だけ。
// 要素の中身の HTML に書かれた <img> や、テーマ CSS の url() は対象外（そのまま残す）。

import type { Deck } from './types';

/** 画像を置くフォルダ（deck.html からの相対パス） */
export const IMAGE_DIR = 'images';

/**
 * 管理対象の画像パスの形。images/ の直下の1ファイルだけで、名前は英数字・_・- に限る。
 * `..` や入れ子のフォルダ（images/a/b.png）、空の名前は通さない（フォルダの外を読み書きしないため）
 */
const IMAGE_PATH = /^images\/[A-Za-z0-9_-]+\.(png|jpe?g|gif|webp|svg|avif)$/;

/** 管理対象の画像パスか。外から来る値（ファイルの src・プラグインの Msg）にも使うので unknown を受ける */
export function isImagePath(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_PATH.test(value);
}

/** MIME 型 → 拡張子。ここに無い型の画像は images/ に置かない */
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

/** MIME 型に対応する拡張子（対応していない型なら null） */
export function extensionOf(mimeType: string): string | null {
  return EXTENSIONS[mimeType.toLowerCase()] ?? null;
}

/** 画像パスの拡張子から MIME 型を決める（管理対象のパスでなければ null） */
export function mimeTypeOf(path: string): string | null {
  if (!isImagePath(path)) return null;
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'jpeg') return 'image/jpeg';
  return Object.keys(EXTENSIONS).find((type) => EXTENSIONS[type] === ext) ?? null;
}

/**
 * 中身のハッシュ（16進）と MIME 型から、画像のパス（images/<ハッシュ>.<拡張子>）を作る。
 * 対応していない MIME 型、ハッシュに使えない文字が入っているときは null
 */
export function imagePath(hash: string, mimeType: string): string | null {
  const ext = extensionOf(mimeType);
  if (!ext) return null;
  const path = `${IMAGE_DIR}/${hash}.${ext}`;
  return isImagePath(path) ? path : null;
}

/** デッキで使っている管理対象の画像パスの一覧（全スライドの img 要素の src から。重複なし、出てきた順） */
export function usedImagePaths(deck: Deck): string[] {
  const paths = new Set<string>();
  for (const slide of deck.slides) {
    for (const el of slide.elements) {
      if (el.tag === 'img' && isImagePath(el.attrs.src)) paths.add(el.attrs.src);
    }
  }
  return [...paths];
}

/** 使っている画像のうち、中身（Blob）を持っていないもののパス */
export function missingImagePaths(deck: Deck, images: Record<string, Blob>): string[] {
  return usedImagePaths(deck).filter((path) => !Object.prototype.hasOwnProperty.call(images, path));
}

/**
 * 保存するときに中身を書き出す画像（images/ に書く、またはフォルダに書けないときに埋め込む）。
 * 使っている画像のうち、中身を持っているものだけ。使っていない画像・中身の無い画像（参照のまま残す）は含まない
 */
export function imagesToWrite(deck: Deck, images: Record<string, Blob>): Record<string, Blob> {
  const out: Record<string, Blob> = {};
  for (const path of usedImagePaths(deck)) {
    if (Object.prototype.hasOwnProperty.call(images, path)) out[path] = images[path];
  }
  return out;
}

// --- 外から来る値 -------------------------------------------------------------

/**
 * フォルダから読む画像1つの大きさの上限。
 * スライドの画像としては十分に大きく、うっかり動画などの巨大なファイルを読み込んでメモリを使い切らない程度にしている
 */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * images/ から読んだファイルを確かめる。読んでよければ null、だめなら理由を返す。
 * 確かめること: File であるか・空でないか・画像の MIME 型か（型が空なら拡張子で判断するので通す）・大きすぎないか
 */
export function checkImageFile(value: unknown): string | null {
  if (typeof File === 'undefined' || !(value instanceof File)) return 'ファイルではありません';
  if (value.size === 0) return '空のファイルです';
  if (value.type !== '' && !value.type.startsWith('image/')) return `画像ではありません（${value.type}）`;
  if (value.size > MAX_IMAGE_BYTES) return `大きすぎます（${MAX_IMAGE_BYTES / 1024 / 1024}MB まで）`;
  return null;
}

/**
 * ImagesAdded の images 欄（プラグインからも来る）を確かめ、受け入れられる項目だけを返す。
 * 確かめること: オブジェクトであること・キーが管理対象の画像パスであること・値が Blob であること。
 * 中身が本当にその形式の画像か、名前がハッシュと一致するかまでは確かめない（表示が壊れるだけで、アプリは落ちないため）
 */
export function acceptImages(value: unknown): { images: Record<string, Blob>; rejected: string[] } {
  const images: Record<string, Blob> = {};
  const rejected: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { images, rejected: [String(value)] };
  }
  for (const [path, blob] of Object.entries(value)) {
    if (isImagePath(path) && blob instanceof Blob) images[path] = blob;
    else rejected.push(path);
  }
  return { images, rejected };
}
