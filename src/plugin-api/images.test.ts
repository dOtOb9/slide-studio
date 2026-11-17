// プラグインに公開した画像の API（1.2）。挿入のプラグインが「Blob → パス → ImagesAdded」をできること。

import { describe, expect, it } from 'vitest';
import { initModel } from '../app/model';
import { update } from '../app/update';
import { parseDeck } from '../model/parse';
import { api, API_VERSION, imagePath, imagePathOf, isCompatible, isImagePath, sha256Hex } from './index';

// "abc" の SHA-256（FIPS 180-2 の例）
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

  it('外部プラグインに渡す api にも入っていて、版は 1.2', () => {
    expect(API_VERSION).toBe('1.2');
    expect(isCompatible('1.2')).toBe(true);
    expect(isCompatible('1.1')).toBe(true);
    expect(api.imagePathOf).toBe(imagePathOf);
    expect(api.sha256Hex).toBe(sha256Hex);
    expect(api.imagePath).toBe(imagePath);
    expect(api.isImagePath).toBe(isImagePath);
  });
});
