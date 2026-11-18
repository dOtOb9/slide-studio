import { imagePath, imagesToWrite, mimeTypeOf } from '../model/images';
import { serializeDeck, type ResolveSrc } from '../model/serialize';
import type { Deck } from '../model/types';

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function imagePathOf(blob: Blob): Promise<string | null> {
  return imagePath(await sha256Hex(blob), blob.type);
}

const oneBlobUrlPerBlobNeverRevokedSoShownImagesStayValid = new WeakMap<Blob, string>();

function blobUrl(blob: Blob): string {
  let url = oneBlobUrlPerBlobNeverRevokedSoShownImagesStayValid.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    oneBlobUrlPerBlobNeverRevokedSoShownImagesStayValid.set(blob, url);
  }
  return url;
}

export function displaySrcLeavingMissingAsBrokenPath(images: Record<string, Blob>): ResolveSrc {
  return (path) => {
    const blob = images[path];
    return blob ? blobUrl(blob) : path;
  };
}

function toDataUri(blob: Blob, fallbackType: string): Promise<string> {
  const typed = blob.type ? blob : new Blob([blob], { type: fallbackType });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(typed);
  });
}

export async function embedSrc(images: Record<string, Blob>): Promise<ResolveSrc> {
  const uris: Record<string, string> = {};
  for (const [path, blob] of Object.entries(images)) {
    uris[path] = await toDataUri(blob, mimeTypeOf(path) ?? 'application/octet-stream');
  }
  return (path) => uris[path] ?? path;
}

export async function deckHtml(deck: Deck, images: Record<string, Blob>, imagesWrittenToFolder: boolean): Promise<string> {
  if (imagesWrittenToFolder) return serializeDeck(deck);
  return serializeDeck(deck, await embedSrc(imagesToWrite(deck, images)));
}
