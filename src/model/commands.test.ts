import { describe, expect, it } from 'vitest';
import sample from '../samples/sample-deck.html?raw';
import {
  addSlide,
  deleteElement,
  deleteSlide,
  duplicateSlide,
  insertElement,
  isEmptyHtml,
  moveSlide,
  setNotes,
  updateElement,
} from './commands';
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

describe('スライドの操作', () => {
  /** テスト用の id 生成（t1, t2, ... と予測できる値を返す） */
  const ids = () => {
    let n = 0;
    return () => `t${++n}`;
  };

  it('addSlide: レイアウトのプレースホルダーを空の要素として持つスライドを、指定位置の後ろに入れる', () => {
    const next = addSlide(deck, 0, 'title-body', ids());
    expect(next.slides).toHaveLength(deck.slides.length + 1);
    const added = next.slides[1];
    expect(added.id).toBe('t1');
    expect(added.layout).toBe('title-body');
    expect(added.elements.map((e) => [e.id, e.ph, e.html])).toEqual([
      ['t2', 'title', ''],
      ['t3', 'body', ''],
    ]);
    // 空のプレースホルダーも保存でき、読み直しても残る
    expect(serializeDeck(next)).toContain('<div data-ph="title"></div>');
    expect(parseDeck(serializeDeck(next)).slides[1].elements).toHaveLength(2);
  });

  it('addSlide: index = -1 なら先頭に入れる', () => {
    expect(addSlide(deck, -1, 'blank', ids()).slides[0].layout).toBe('blank');
  });

  it('duplicateSlide: 中身は同じで、id はすべて新しい', () => {
    const next = duplicateSlide(deck, 2, ids());
    const [a, b] = [next.slides[2], next.slides[3]];
    expect(b.elements.map((e) => e.html)).toEqual(a.elements.map((e) => e.html));
    expect(b.id).not.toBe(a.id);
    expect(b.elements.map((e) => e.id)).toEqual(['t2', 't3', 't4', 't5']);
    // 複製の rect を変えても元は変わらない（入れ子のオブジェクトも別物）
    expect(b.elements[1].rect).not.toBe(a.elements[1].rect);
  });

  it('deleteSlide / moveSlide', () => {
    expect(deleteSlide(deck, 0).slides.map((s) => s.id)).toEqual(deck.slides.slice(1).map((s) => s.id));
    const ids0 = deck.slides.map((s) => s.id);
    expect(moveSlide(deck, 0, 2).slides.map((s) => s.id)).toEqual([ids0[1], ids0[2], ids0[0], ids0[3]]);
    expect(moveSlide(deck, 3, 0).slides.map((s) => s.id)).toEqual([ids0[3], ids0[0], ids0[1], ids0[2]]);
  });

  it('範囲外の指定では元の Deck をそのまま返す', () => {
    expect(deleteSlide(deck, 9)).toBe(deck);
    expect(duplicateSlide(deck, 9, ids())).toBe(deck);
    expect(moveSlide(deck, 1, 1)).toBe(deck);
    expect(moveSlide(deck, 0, 9)).toBe(deck);
  });

  it('isEmptyHtml', () => {
    expect(isEmptyHtml('')).toBe(true);
    expect(isEmptyHtml(' <br> ')).toBe(true);
    expect(isEmptyHtml('&nbsp;')).toBe(true);
    expect(isEmptyHtml('a')).toBe(false);
  });
});

describe('insertElement / setNotes', () => {
  it('insertElement は最前面（末尾）に追加する', () => {
    const el = { id: 'x', tag: 'div', rect: { x: 0, y: 0, w: 10, h: 10 }, style: '', attrs: {}, html: '' };
    const next = insertElement(deck, slide.id, el);
    const elements = next.slides[1].elements;
    expect(elements[elements.length - 1]).toBe(el);
  });

  it('setNotes は同じ内容なら元の Deck を返す', () => {
    expect(setNotes(deck, slide.id, slide.notes)).toBe(deck);
    expect(setNotes(deck, slide.id, 'x').slides[1].notes).toBe('x');
  });
});
