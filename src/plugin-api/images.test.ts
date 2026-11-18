import { describe, expect, it } from 'vitest';
import { initModel } from '../app/model';
import { update } from '../app/update';
import { parseDeck } from '../model/parse';
import {
  api,
  checkImageFile,
  extensionOf,
  imagePath,
  imagePathOf,
  isCompatible,
  isImagePath,
  sha256Hex,
} from './index';

const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('画像の公開 API', () => {
  it('sha256Hex は中身の SHA-256 を16進で返す', async () => {
    expect(await sha256Hex(new Blob(['abc']))).toBe(ABC);
  });

  it('imagePathOf は Blob の中身と型からパスを作る。対応しない型なら null', async () => {
    expect(await imagePathOf(new Blob(['abc'], { type: 'image/png' }))).toBe(`images/${ABC}.png`);
    expect(await imagePathOf(new Blob(['abc'], { type: 'image/jpeg' }))).toBe(`images/${ABC}.jpg`);
    expect(await imagePathOf(new Blob(['abc'], { type: 'text/plain' }))).toBeNull();
    expect(await imagePathOf(new Blob(['abc']))).toBeNull();
  });

  it('作ったパスで ImagesAdded を送ると、Model.images に入る', async () => {
    const blob = new Blob(['abc'], { type: 'image/png' });
    const path = (await imagePathOf(blob))!;
    const m = update(initModel(parseDeck('<body></body>'), 'a.html'), { type: 'ImagesAdded', images: { [path]: blob } });
    expect(m.images[path]).toBe(blob);
  });

  it('受け取ったファイルを確かめる関数（1.3）: 対応する形式なら拡張子、だめなファイルなら理由', () => {
    expect(extensionOf('image/png')).toBe('png');
    expect(extensionOf('image/bmp')).toBeNull();
    expect(checkImageFile(new File(['abc'], 'a.png', { type: 'image/png' }))).toBeNull();
    expect(checkImageFile(new File([], 'a.png', { type: 'image/png' }))).toMatch(/空/);
    expect(checkImageFile('a.png')).toMatch(/ファイルではありません/);
  });

  it('外部プラグインに渡す api にも入っていて、1.3 以前のプラグインも動く', () => {
    expect(isCompatible('1.3')).toBe(true);
    expect(isCompatible('1.2')).toBe(true);
    expect(isCompatible('1.1')).toBe(true);
    expect(api.imagePathOf).toBe(imagePathOf);
    expect(api.sha256Hex).toBe(sha256Hex);
    expect(api.imagePath).toBe(imagePath);
    expect(api.isImagePath).toBe(isImagePath);
    expect(api.checkImageFile).toBe(checkImageFile);
    expect(api.extensionOf).toBe(extensionOf);
  });
});
