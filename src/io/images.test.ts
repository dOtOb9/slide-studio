import { describe, expect, it } from 'vitest';
import { parseDeck } from '../model/parse';
import { deckHtml, dataUriSrc } from './images';

const A = `images/${'a'.repeat(64)}.png`;
const B = `images/${'b'.repeat(64)}.svg`;
const C = `images/${'c'.repeat(64)}.png`;

const deck = parseDeck(`<body><section>
  <img data-el src="${A}">
  <img data-el src="${B}">
  <img data-el src="data:image/gif;base64,R0lGOD">
</section></body>`);
const srcs = (html: string) => parseDeck(html).slides[0].elements.map((e) => e.attrs.src);

const images = {
  [A]: new Blob(['png'], { type: 'image/png' }),
  [C]: new Blob(['unused'], { type: 'image/png' }),
};

describe('deckHtml', () => {
  it('フォルダに書けるときは、src はパスのまま', async () => {
    expect(srcs(await deckHtml(deck, images, true))).toEqual([A, B, 'data:image/gif;base64,R0lGOD']);
  });

  it('フォルダに書けないときは、中身のある画像を data URI で埋め込み、中身の無い画像は参照のまま', async () => {
    const html = await deckHtml(deck, images, false);
    expect(srcs(html)).toEqual([`data:image/png;base64,${btoa('png')}`, B, 'data:image/gif;base64,R0lGOD']);
    expect(html).not.toContain(btoa('unused'));
  });
});

describe('dataUriSrc', () => {
  it('型が空の Blob は、パスの拡張子から型を決める', async () => {
    const resolve = await dataUriSrc({ [B]: new Blob(['<svg/>']) });
    expect(resolve(B)).toBe(`data:image/svg+xml;base64,${btoa('<svg/>')}`);
    expect(resolve(A)).toBe(A);
  });
});
