import { describe, expect, it } from 'vitest';
import sample from '../samples/sample-deck.html?raw';
import { deleteElement, updateElement } from './commands';
import { parseDeck } from './parse';
import { resolveRect } from './render';
import { serializeDeck } from './serialize';

const deck = parseDeck(sample);
const slide = deck.slides[1]; // title-body
const title = slide.elements[0];

describe('updateElement', () => {
  it('プレースホルダーを動かすと、動かした分だけが上書きとして記録される', () => {
    const next = updateElement(deck, slide.id, title.id, { rect: { x: 300.4, y: 99.6 } });
    const moved = next.slides[1].elements[0];
    expect(moved.rect).toEqual({ x: 300, y: 100 });
    expect(resolveRect(next, next.slides[1], moved)).toEqual({ x: 300, y: 100, w: 1680, h: 140 });
    expect(serializeDeck(next)).toContain('<div data-ph="title" style="left:300px; top:100px">');
  });

  it('元の Deck は書き換えず、変更していないスライドは同じオブジェクトのまま', () => {
    const next = updateElement(deck, slide.id, title.id, { html: '新しいタイトル' });
    expect(deck.slides[1].elements[0].html).toBe('このファイルの仕組み');
    expect(next.slides[1].elements[0].html).toBe('新しいタイトル');
    expect(next.slides[0]).toBe(deck.slides[0]);
    expect(next.slides[1]).not.toBe(deck.slides[1]);
  });
});

describe('updateElement（異常な入力）', () => {
  it('NaN や Infinity は捨て、ファイルに書き出さない', () => {
    const next = updateElement(deck, slide.id, title.id, { rect: { x: NaN, w: Infinity, y: 50 } });
    expect(next.slides[1].elements[0].rect).toEqual({ y: 50 });
    expect(serializeDeck(next)).not.toContain('NaN');
  });

  it('存在しない id なら元の Deck をそのまま返す', () => {
    expect(updateElement(deck, slide.id, 'no-such-id', { html: 'x' })).toBe(deck);
  });

  it('丸めた結果が同じなら元の Deck をそのまま返す（空の履歴を積まないため）', () => {
    const moved = updateElement(deck, slide.id, title.id, { rect: { x: 300 } });
    expect(updateElement(moved, slide.id, title.id, { rect: { x: 300.3 } })).toBe(moved);
    expect(updateElement(deck, slide.id, title.id, { html: title.html })).toBe(deck);
  });
});

describe('deleteElement', () => {
  it('存在しない id なら元の Deck をそのまま返す', () => {
    expect(deleteElement(deck, slide.id, 'no-such-id')).toBe(deck);
  });

  it('要素を取り除く', () => {
    const next = deleteElement(deck, slide.id, title.id);
    expect(next.slides[1].elements.map((e) => e.ph)).toEqual(['body']);
  });
});
