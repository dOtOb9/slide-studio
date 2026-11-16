// 機能のテスト。わざと「機能自身のモジュール」を最初に import している。
// 機能を作るエージェントが自然に書く順番で、循環 import によって registry が壊れないことの確認を兼ねる。
import { shapes } from './feature';

import { describe, expect, it } from 'vitest';
import { initModel } from '../../app/model';
import { update } from '../../app/update';
import { parseDeck } from '../../model/parse';
import sample from '../../samples/sample-deck.html?raw';
import { features, updateFeature } from '../registry';

const setup = () => update(initModel(parseDeck(sample), 't.html'), { type: 'SlideSelected', index: 1 });

describe('登録', () => {
  it('機能のモジュールを先に読み込んでも、registry に正しく登録されている', () => {
    expect(features).toContain(shapes);
    expect(features.every((f) => f !== undefined)).toBe(true);
  });

  it('登録されていない機能の Msg は黙って捨てずに例外にする', () => {
    const bogus = { type: 'nosuch/Thing' } as unknown as Parameters<typeof updateFeature>[1];
    expect(() => updateFeature(setup(), bogus)).toThrow('登録されていない機能の Msg: nosuch/Thing');
  });
});

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

  it('矢印は SVG として挿入し、テキスト編集には入れない', () => {
    const m = update(setup(), { type: 'shapes/Inserted', shape: 'arrow' });
    const els = m.deck.slides[1].elements;
    const arrow = els[els.length - 1];
    expect(arrow.tag).toBe('svg');
    expect(update(m, { type: 'EditRequested', id: arrow.id }).editingId).toBeNull();
    expect(update(m, { type: 'KeyPressed', key: 'Enter', shift: false, mod: false }).editingId).toBeNull();
  });

  it('スライドが 0 枚・テキスト編集中は何もしない', () => {
    const empty = initModel(parseDeck('<body></body>'), 'e.html');
    expect(update(empty, { type: 'shapes/Inserted', shape: 'text' })).toBe(empty);
    const m0 = setup();
    const editing = update(m0, { type: 'EditRequested', id: m0.deck.slides[1].elements[0].id });
    expect(update(editing, { type: 'shapes/Inserted', shape: 'text' })).toBe(editing);
  });
});
