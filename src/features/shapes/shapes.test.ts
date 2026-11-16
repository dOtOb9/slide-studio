// 機能の Msg も、土台の update に流すだけでテストできる（registry 経由で shapes の update に届く）。

import { describe, expect, it } from 'vitest';
import { initModel } from '../../app/model';
import { update } from '../../app/update';
import { parseDeck } from '../../model/parse';
import sample from '../../samples/sample-deck.html?raw';

const setup = () => update(initModel(parseDeck(sample), 't.html'), { type: 'SlideSelected', index: 1 });

describe('shapes/Inserted', () => {
  it('表示中のスライドの中央に挿入し、選択する。1回の Undo で消える', () => {
    const m0 = setup();
    const m = update(m0, { type: 'shapes/Inserted', shape: 'rect' });
    const els = m.deck.slides[1].elements;
    const added = els[els.length - 1];
    expect(added).toMatchObject({ id: 'n1', tag: 'div', attrs: { 'data-shape': 'rect' } });
    expect(added.rect).toEqual({ x: 760, y: 390, w: 400, h: 300 });
    expect(m.selectedId).toBe('n1');
    expect(m.nextId).toBe(2);
    expect(update(m, { type: 'Undo' }).deck).toBe(m0.deck);
  });

  it('矢印は SVG として挿入する', () => {
    const m = update(setup(), { type: 'shapes/Inserted', shape: 'arrow' });
    const els = m.deck.slides[1].elements;
    expect(els[els.length - 1].tag).toBe('svg');
  });

  it('スライドが 0 枚・テキスト編集中は何もしない', () => {
    const empty = initModel(parseDeck('<body></body>'), 'e.html');
    expect(update(empty, { type: 'shapes/Inserted', shape: 'text' })).toBe(empty);
    const m0 = setup();
    const editing = update(m0, { type: 'EditRequested', id: m0.deck.slides[1].elements[0].id });
    expect(update(editing, { type: 'shapes/Inserted', shape: 'text' })).toBe(editing);
  });
});
