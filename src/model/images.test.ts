import { describe, expect, it } from 'vitest';
import {
  acceptImages,
  checkImageFile,
  extensionOf,
  imagePath,
  isImagePath,
  MAX_IMAGE_BYTES,
  mimeTypeOf,
  missingImagePaths,
  usedImagePaths,
} from './images';
import { parseDeck } from './parse';

const HASH = 'a'.repeat(64);

describe('isImagePath（管理対象の画像パスか）', () => {
  it('images/ 直下の、対応する拡張子のファイルだけを通す', () => {
    for (const ok of ['images/abc.png', 'images/a_b-1.jpg', 'images/x.jpeg', 'images/x.gif', 'images/x.webp', 'images/x.svg', 'images/x.avif']) {
      expect(isImagePath(ok), ok).toBe(true);
    }
  });

  it('外に出るパス・入れ子・空の名前・ほかの書き方は通さない', () => {
    for (const bad of [
      'images/../deck.html',
      'images/../a.png',
      'images/a/b.png',
      'images/.png',
      'images/',
      './images/a.png',
      '/images/a.png',
      'images\\a.png',
      'Images/a.png',
      'images/a.png?x=1',
      'images/a.exe',
      'data:image/png;base64,AAAA',
      'https://example.com/images/a.png',
      '',
    ]) {
      expect(isImagePath(bad), bad).toBe(false);
    }
  });

  it('文字列でない値は通さない（外から来る値に使う）', () => {
    for (const bad of [undefined, null, 1, {}, ['images/a.png']]) expect(isImagePath(bad)).toBe(false);
  });
});

describe('MIME 型と拡張子', () => {
  it('対応する型は拡張子に変わり、知らない型は null', () => {
    expect(extensionOf('image/png')).toBe('png');
    expect(extensionOf('image/jpeg')).toBe('jpg');
    expect(extensionOf('IMAGE/SVG+XML')).toBe('svg');
    expect(extensionOf('image/bmp')).toBeNull();
    expect(extensionOf('text/html')).toBeNull();
  });

  it('パスの拡張子から MIME 型を決める', () => {
    expect(mimeTypeOf('images/a.png')).toBe('image/png');
    expect(mimeTypeOf('images/a.jpeg')).toBe('image/jpeg');
    expect(mimeTypeOf('images/a.jpg')).toBe('image/jpeg');
    expect(mimeTypeOf('images/a.svg')).toBe('image/svg+xml');
    expect(mimeTypeOf('other/a.png')).toBeNull();
  });

  it('imagePath はハッシュと型からパスを作る。対応しない型や使えない文字は null', () => {
    expect(imagePath(HASH, 'image/png')).toBe(`images/${HASH}.png`);
    expect(imagePath(HASH, 'image/bmp')).toBeNull();
    expect(imagePath('../x', 'image/png')).toBeNull();
    expect(imagePath('', 'image/png')).toBeNull();
  });
});

describe('使っている画像の一覧', () => {
  const deck = parseDeck(`<!doctype html><body>
<section>
  <img data-el src="images/a.png">
  <img data-el src="data:image/png;base64,AAAA">
  <div data-el><img src="images/inner.png"></div>
  <img data-el src="images/b.jpg">
</section>
<section>
  <img data-el src="images/a.png">
  <img data-el src="images/../x.png">
  <div data-el src="images/c.png"></div>
</section>
<section><img data-el src="images/c.svg"></section>
</body>`);

  it('全スライドの img 要素の管理対象の src を、重複なく出てきた順に返す', () => {
    // 要素の中身の <img>、data URI、外に出るパス、img 以外の要素の src は対象外
    expect(usedImagePaths(deck)).toEqual(['images/a.png', 'images/b.jpg', 'images/c.svg']);
  });

  it('中身を持っていない画像だけを返す', () => {
    const images = { 'images/b.jpg': new Blob(['x']) };
    expect(missingImagePaths(deck, images)).toEqual(['images/a.png', 'images/c.svg']);
  });

  it('画像の無いデッキでは空', () => {
    expect(usedImagePaths(parseDeck('<body><section><div data-el>a</div></section></body>'))).toEqual([]);
  });
});

describe('外から来る値: images/ から読んだファイル（checkImageFile）', () => {
  it('画像のファイルなら null（読んでよい）', () => {
    expect(checkImageFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull();
    // 型が空（ブラウザが拡張子から決められなかった）でも、パスで拡張子を確かめているので通す
    expect(checkImageFile(new File(['x'], 'a.avif', { type: '' }))).toBeNull();
  });

  it('File でない・空・画像でない型・大きすぎるものは理由を返す', () => {
    expect(checkImageFile(null)).toMatch(/ファイルではありません/);
    expect(checkImageFile('images/a.png')).toMatch(/ファイルではありません/);
    expect(checkImageFile(new Blob(['x'], { type: 'image/png' }))).toMatch(/ファイルではありません/);
    expect(checkImageFile(new File([], 'a.png', { type: 'image/png' }))).toMatch(/空/);
    expect(checkImageFile(new File(['<html>'], 'a.png', { type: 'text/html' }))).toMatch(/画像ではありません/);
    // 本当に 50MB を作らないよう、size だけ大きく見せる
    const big = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: MAX_IMAGE_BYTES + 1 });
    expect(checkImageFile(big)).toMatch(/大きすぎます/);
  });
});

describe('外から来る値: ImagesAdded の images 欄（acceptImages）', () => {
  it('管理対象のパスと Blob の組だけを受け入れ、ほかは捨てた名前として返す', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const { images, rejected } = acceptImages({
      'images/a.png': blob,
      'images/../a.png': blob,
      'data:image/png;base64,AAAA': blob,
      'images/b.png': 'not a blob',
      'images/c.png': null,
      'images/d.png': {},
    });
    expect(images).toEqual({ 'images/a.png': blob });
    expect(images['images/a.png']).toBe(blob);
    expect(rejected).toEqual(['images/../a.png', 'data:image/png;base64,AAAA', 'images/b.png', 'images/c.png', 'images/d.png']);
  });

  it('オブジェクトでなければ何も受け入れない', () => {
    for (const bad of [undefined, null, 'images/a.png', 1, [new Blob(['x'])]]) {
      const { images, rejected } = acceptImages(bad);
      expect(images).toEqual({});
      expect(rejected).toHaveLength(1);
    }
  });
});
