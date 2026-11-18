import type { Deck } from './types';

export const IMAGE_DIR = 'images';

const MANAGED_IMAGE_PATH_DIRECTLY_UNDER_IMAGE_DIR = /^images\/[A-Za-z0-9_-]+\.(png|jpe?g|gif|webp|svg|avif)$/;

export function isImagePath(value: unknown): value is string {
  return typeof value === 'string' && MANAGED_IMAGE_PATH_DIRECTLY_UNDER_IMAGE_DIR.test(value);
}

const EXTENSIONS_STORABLE_IN_IMAGE_DIR: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

export function extensionOf(mimeType: string): string | null {
  return EXTENSIONS_STORABLE_IN_IMAGE_DIR[mimeType.toLowerCase()] ?? null;
}

export function mimeTypeOf(path: string): string | null {
  if (!isImagePath(path)) return null;
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'jpeg') return 'image/jpeg';
  return Object.keys(EXTENSIONS_STORABLE_IN_IMAGE_DIR).find((type) => EXTENSIONS_STORABLE_IN_IMAGE_DIR[type] === ext) ?? null;
}

export function imagePath(hash: string, mimeType: string): string | null {
  const ext = extensionOf(mimeType);
  if (!ext) return null;
  const path = `${IMAGE_DIR}/${hash}.${ext}`;
  return isImagePath(path) ? path : null;
}

export function usedImagePaths(deck: Deck): string[] {
  const paths = new Set<string>();
  for (const slide of deck.slides) {
    for (const el of slide.elements) {
      if (el.tag === 'img' && isImagePath(el.attrs.src)) paths.add(el.attrs.src);
    }
  }
  return [...paths];
}

export function missingImagePaths(deck: Deck, images: Record<string, Blob>): string[] {
  return usedImagePaths(deck).filter((path) => !Object.prototype.hasOwnProperty.call(images, path));
}

export function imagesToWrite(deck: Deck, images: Record<string, Blob>): Record<string, Blob> {
  const out: Record<string, Blob> = {};
  for (const path of usedImagePaths(deck)) {
    if (Object.prototype.hasOwnProperty.call(images, path)) out[path] = images[path];
  }
  return out;
}

export interface SaveDestination {
  overwritesOpenedFile: boolean;
  directlyInGrantedFolder: boolean;
}

export function imagesLostBySave(deck: Deck, images: Record<string, Blob>, dest: SaveDestination): string[] {
  const missingImagesShouldAlreadyBeInThatImageDir = dest.overwritesOpenedFile || dest.directlyInGrantedFolder;
  if (missingImagesShouldAlreadyBeInThatImageDir) return [];
  return missingImagePaths(deck, images);
}

export function lostImagesQuestion(count: number, browserOffersFolderAccessButton: boolean): string {
  const lead = `${count} 枚の画像を読み込めていないため、新しい場所では表示されません`;
  if (browserOffersFolderAccessButton) return `${lead}。先に『フォルダへのアクセスを許可』で読み込んでください。保存を続けますか？`;
  return `${lead}（元の images/ フォルダの隣に置けば表示されます）。保存を続けますか？`;
}

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

export function checkImageFile(value: unknown): string | null {
  if (typeof File === 'undefined' || !(value instanceof File)) return 'ファイルではありません';
  if (value.size === 0) return '空のファイルです';
  const browserCouldNotTellTypeFromExtension = value.type === '';
  if (!browserCouldNotTellTypeFromExtension && !value.type.startsWith('image/')) return `画像ではありません（${value.type}）`;
  if (value.size > MAX_IMAGE_BYTES) return `大きすぎます（${MAX_IMAGE_BYTES / 1024 / 1024}MB まで）`;
  return null;
}

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
