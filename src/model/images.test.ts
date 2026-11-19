import { describe, expect, it } from 'vitest';
import {
  acceptImages,
  checkImageFile,
  extensionOf,
  imagePath,
  imagesLostBySave,
  imagesToWrite,
  isImagePath,
  lostImagesQuestion,
  missingImagesExportQuestion,
  MAX_IMAGE_BYTES,
  mimeTypeOf,
  missingImagePaths,
  usedImagePaths,
} from './images';
import { parseDeck } from './parse';
import { renderSlideHtml } from './render';
import { serializeDeck } from './serialize';

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
  });

  it('ブラウザが拡張子から型を決められず型が空でも通す（拡張子は isImagePath がパスで確かめている）', () => {
    expect(checkImageFile(new File(['x'], 'a.avif', { type: '' }))).toBeNull();
  });

  it('File でない・空・画像でない型・大きすぎるものは理由を返す', () => {
    expect(checkImageFile(null)).toMatch(/ファイルではありません/);
    expect(checkImageFile('images/a.png')).toMatch(/ファイルではありません/);
    expect(checkImageFile(new Blob(['x'], { type: 'image/png' }))).toMatch(/ファイルではありません/);
    expect(checkImageFile(new File([], 'a.png', { type: 'image/png' }))).toMatch(/空/);
    expect(checkImageFile(new File(['<html>'], 'a.png', { type: 'text/html' }))).toMatch(/画像ではありません/);
    const bigLookingFileWithoutAllocating50MB = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(bigLookingFileWithoutAllocating50MB, 'size', { value: MAX_IMAGE_BYTES + 1 });
    expect(checkImageFile(bigLookingFileWithoutAllocating50MB)).toMatch(/大きすぎます/);
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

  it('中身が本当にその形式の画像か・名前が中身のハッシュと一致するかは確かめない（表示が崩れるだけでアプリは落ちないため）', () => {
    const notReallyPng = new Blob(['<html>'], { type: 'text/html' });
    expect(acceptImages({ 'images/not-a-hash.png': notReallyPng }).images).toEqual({ 'images/not-a-hash.png': notReallyPng });
  });

  it('オブジェクトでなければ何も受け入れない', () => {
    for (const bad of [undefined, null, 'images/a.png', 1, [new Blob(['x'])]]) {
      const { images, rejected } = acceptImages(bad);
      expect(images).toEqual({});
      expect(rejected).toHaveLength(1);
    }
  });
});

describe('images/ の画像とファイル形式', () => {
  const html = `<!doctype html><body>
<section data-layout="blank">
  <img data-el src="images/${HASH}.png" alt="写真" style="left:10px; top:20px; width:300px; height:200px">
  <img data-el src="data:image/svg+xml;base64,PHN2Zy8+" style="left:400px; top:20px">
  <img data-el src="images/../outside.png">
  <img data-el src="https://example.com/a.png">
  <div data-el><img src="images/${HASH}.png"></div>
</section>
</body>`;
  const deck = parseDeck(html);
  const srcs = (d: typeof deck) => d.slides[0].elements.map((e) => e.attrs.src ?? e.html);

  it('images/ 参照・data URI・管理対象外の src が、読み込み→書き出し→読み込みで変わらない（ラウンドトリップ）', () => {
    const again = parseDeck(serializeDeck(deck));
    expect(srcs(again)).toEqual(srcs(deck));
    expect(srcs(deck)).toEqual([
      `images/${HASH}.png`,
      'data:image/svg+xml;base64,PHN2Zy8+',
      'images/../outside.png',
      'https://example.com/a.png',
      `<img src="images/${HASH}.png">`,
    ]);
    expect(serializeDeck(again)).toBe(serializeDeck(deck));
  });

  it('serializeDeck に resolveSrc を渡すと、管理対象の画像の src だけを差し替えて書く（埋め込み用）', () => {
    const out = serializeDeck(deck, (path) => `data:image/png;base64,${path.length}`);
    const written = parseDeck(out);
    expect(srcs(written)).toEqual([
      `data:image/png;base64,${`images/${HASH}.png`.length}`,
      'data:image/svg+xml;base64,PHN2Zy8+',
      'images/../outside.png',
      'https://example.com/a.png',
      `<img src="images/${HASH}.png">`,
    ]);
    expect(deck.slides[0].elements[0].attrs.src).toBe(`images/${HASH}.png`);
  });

  it('renderSlideHtml に resolveSrc を渡すと、管理対象の画像の src だけが差し替わる', () => {
    const seen: string[] = [];
    const rendered = renderSlideHtml(deck, deck.slides[0], (path) => {
      seen.push(path);
      return 'blob:http://localhost/1234';
    });
    expect(seen).toEqual([`images/${HASH}.png`]);
    const doc = new DOMParser().parseFromString(rendered, 'text/html');
    const imgs = Array.from(doc.querySelectorAll('section > img')).map((i) => i.getAttribute('src'));
    expect(imgs).toEqual([
      'blob:http://localhost/1234',
      'data:image/svg+xml;base64,PHN2Zy8+',
      'images/../outside.png',
      'https://example.com/a.png',
    ]);
    expect(doc.querySelector('section > div img')!.getAttribute('src')).toBe(`images/${HASH}.png`);
    expect(doc.querySelector('section > img')!.getAttribute('alt')).toBe('写真');
  });

  it('resolveSrc を省略すると、src はそのまま', () => {
    expect(renderSlideHtml(deck, deck.slides[0])).toContain(`src="images/${HASH}.png"`);
  });
});

describe('imagesToWrite（保存で中身を書き出す画像。Step 8 audit-1 #2）', () => {
  it('使っている画像のうち中身のあるものだけ。使っていない画像・中身の無い画像は含まない', () => {
    const A = `images/${'a'.repeat(64)}.png`;
    const B = `images/${'b'.repeat(64)}.png`;
    const C = `images/${'c'.repeat(64)}.png`;
    const deck = parseDeck(`<body><section><img data-el src="${A}"><img data-el src="${B}"><img data-el src="${A}"></section></body>`);
    const a = new Blob(['a']);
    const c = new Blob(['c']);
    const out = imagesToWrite(deck, { [A]: a, [C]: c });
    expect(Object.keys(out)).toEqual([A]);
    expect(out[A]).toBe(a);
  });
});

describe('imagesLostBySave（別の場所への保存で表示されなくなる画像。PR #6 pr-audit 推奨 #1）', () => {
  const A = `images/${'a'.repeat(64)}.png`;
  const B = `images/${'b'.repeat(64)}.png`;
  const C = `images/${'c'.repeat(64)}.png`;
  const deck = parseDeck(`<body><section><img data-el src="${A}"><img data-el src="${B}"></section><section><img data-el src="${C}"></section></body>`);
  const images = { [A]: new Blob(['a']) };

  it('別のフォルダ（上書きでなく、許可済みのフォルダの直下でもない）なら、中身の無い画像を返す', () => {
    expect(imagesLostBySave(deck, images, { overwritesOpenedFile: false, directlyInGrantedFolder: false })).toEqual([B, C]);
  });

  it('上書き保存では何も返さない（中身の無い画像はそこの images/ にあるはず）', () => {
    expect(imagesLostBySave(deck, images, { overwritesOpenedFile: true, directlyInGrantedFolder: false })).toEqual([]);
    expect(imagesLostBySave(deck, images, { overwritesOpenedFile: true, directlyInGrantedFolder: true })).toEqual([]);
  });

  it('名前を付けて保存でも、許可済みのフォルダの直下なら何も返さない', () => {
    expect(imagesLostBySave(deck, images, { overwritesOpenedFile: false, directlyInGrantedFolder: true })).toEqual([]);
  });

  it('中身の無い画像が無ければ、別のフォルダでも空', () => {
    const all = { [A]: new Blob(['a']), [B]: new Blob(['b']), [C]: new Blob(['c']) };
    expect(imagesLostBySave(deck, all, { overwritesOpenedFile: false, directlyInGrantedFolder: false })).toEqual([]);
    const noImages = parseDeck('<body><section><div data-el>a</div></section></body>');
    expect(imagesLostBySave(noImages, {}, { overwritesOpenedFile: false, directlyInGrantedFolder: false })).toEqual([]);
  });

  it('知らせる文面に枚数が入る（フォルダを読めるブラウザ）', () => {
    expect(lostImagesQuestion(2, true)).toBe(
      '2 枚の画像を読み込めていないため、新しい場所では表示されません。先に『フォルダへのアクセスを許可』で読み込んでください。保存を続けますか？',
    );
  });

  it('フォルダを読めないブラウザでは『フォルダへのアクセスを許可』を案内しない（save-as audit-1 #1）', () => {
    const text = lostImagesQuestion(2, false);
    expect(text).toContain('2 枚');
    expect(text).toContain('保存を続けますか？');
    expect(text).not.toContain('フォルダへのアクセスを許可');
  });
});

describe('missingImagesExportQuestion（書き出しの前に、読み込めていない画像を知らせる）', () => {
  it('枚数を入れ、フォルダを読めるブラウザでだけ『フォルダへのアクセスを許可』を案内する', () => {
    expect(missingImagesExportQuestion(3, true)).toBe(
      '3 枚の画像を読み込めていないため、書き出したファイルでは表示されません。先に『フォルダへのアクセスを許可』で読み込んでください。書き出しを続けますか？',
    );
    expect(missingImagesExportQuestion(1, false)).toBe('1 枚の画像を読み込めていないため、書き出したファイルでは表示されません。書き出しを続けますか？');
  });
});
