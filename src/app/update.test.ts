// update は純粋な関数なので、「Msg を順に流すとどうなるか」をそのままテストできる。

import { describe, expect, it } from 'vitest';
import { parseDeck } from '../model/parse';
import { resolveRect } from '../model/render';
import sample from '../samples/sample-deck.html?raw';
import { initModel, type Box, type Model } from './model';
import type { Msg } from './msg';
import { update } from './update';

/** Msg を順に流す */
const run = (model: Model, ...msgs: Msg[]) => msgs.reduce(update, model);

/** 3枚目のスライド（title-body, タイトル・本文・円・画像）を表示し、位置を測った状態 */
function setup(): Model {
  const deck = parseDeck(sample);
  const m = update(initModel(deck, 't.html'), { type: 'SlideSelected', index: 2 });
  const boxes: Box[] = m.deck.slides[2].elements.map((el) => {
    const r = resolveRect(m.deck, m.deck.slides[2], el);
    return { id: el.id, x: r.x ?? 0, y: r.y ?? 0, w: r.w ?? 0, h: r.h ?? 0 };
  });
  return update(m, { type: 'BoxesMeasured', boxes });
}

const el = (m: Model, i: number) => m.deck.slides[m.current].elements[i];
const p = (x: number, y: number) => ({ x, y });

describe('ドラッグで移動', () => {
  it('何度動かしても、履歴は1件だけ積まれる', () => {
    const m0 = setup();
    const circle = el(m0, 2).id; // 1240,300
    const m = run(
      m0,
      { type: 'DragStarted', id: circle, handle: null, pointer: p(1300, 400) },
      { type: 'DragMoved', pointer: p(1310, 410), shift: false },
      { type: 'DragMoved', pointer: p(1350, 420), shift: false },
      { type: 'DragEnded' },
    );
    expect(el(m, 2).rect).toMatchObject({ x: 1290, y: 320 });
    expect(m.history.past).toHaveLength(1);
    expect(m.gesture).toBeNull();
    expect(m.selectedId).toBe(circle);
  });

  it('小さな揺れはクリックとみなし、Deck も履歴も変わらない', () => {
    const m0 = setup();
    const m = run(
      m0,
      { type: 'DragStarted', id: el(m0, 2).id, handle: null, pointer: p(1300, 400) },
      { type: 'DragMoved', pointer: p(1302, 401), shift: false },
      { type: 'DragEnded' },
    );
    expect(m.deck).toBe(m0.deck);
    expect(m.history.past).toHaveLength(0);
  });
});

describe('ハンドルでリサイズ', () => {
  it('画像は角で縦横比を保ち、Shift で解除できる', () => {
    const m0 = setup();
    const img = el(m0, 3).id; // 1500,640 320x240
    const se = { hx: 1, hy: 1 } as const;
    const keep = run(
      m0,
      { type: 'DragStarted', id: img, handle: se, pointer: p(0, 0) },
      { type: 'DragMoved', pointer: p(160, 0), shift: false },
    );
    expect(el(keep, 3).rect).toMatchObject({ w: 480, h: 360 });
    const free = update(keep, { type: 'DragMoved', pointer: p(160, 0), shift: true });
    expect(el(free, 3).rect).toMatchObject({ w: 480, h: 240 });
  });
});

describe('元に戻す／やり直し', () => {
  it('戻す→やり直す で元の状態と移動後の状態を行き来できる', () => {
    const m0 = setup();
    const moved = run(
      m0,
      { type: 'DragStarted', id: el(m0, 2).id, handle: null, pointer: p(0, 0) },
      { type: 'DragMoved', pointer: p(100, 0), shift: false },
      { type: 'DragEnded' },
    );
    const undone = update(moved, { type: 'Undo' });
    expect(undone.deck).toBe(m0.deck);
    const redone = update(undone, { type: 'Redo' });
    expect(redone.deck).toBe(moved.deck);
  });

  it('戻した後に新しい編集をすると、やり直しの履歴は消える', () => {
    const m0 = setup();
    const id = el(m0, 2).id;
    const m = run(
      m0,
      { type: 'ElementSelected', id },
      { type: 'KeyPressed', key: 'ArrowRight', shift: false, mod: false },
      { type: 'Undo' },
      { type: 'KeyPressed', key: 'ArrowLeft', shift: false, mod: false },
    );
    expect(m.history.future).toHaveLength(0);
    expect(el(m, 2).rect.x).toBe(1239);
  });

  it('Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z で操作できる', () => {
    const m0 = setup();
    const m1 = run(m0, { type: 'ElementSelected', id: el(m0, 2).id }, { type: 'KeyPressed', key: 'Delete', shift: false, mod: false });
    expect(m1.deck.slides[2].elements).toHaveLength(3);
    const m2 = update(m1, { type: 'KeyPressed', key: 'z', shift: false, mod: true });
    expect(m2.deck).toBe(m0.deck);
    expect(update(m2, { type: 'KeyPressed', key: 'y', shift: false, mod: true }).deck).toBe(m1.deck);
    expect(update(m2, { type: 'KeyPressed', key: 'Z', shift: true, mod: true }).deck).toBe(m1.deck);
  });

  it('別のスライドを表示中に戻すと、変更があったスライドへ移る', () => {
    const m0 = setup();
    const m = run(
      m0,
      { type: 'ElementSelected', id: el(m0, 2).id },
      { type: 'KeyPressed', key: 'Delete', shift: false, mod: false },
      { type: 'SlideSelected', index: 0 },
      { type: 'Undo' },
    );
    expect(m.current).toBe(2);
  });

  it('履歴が無いときの Undo / Redo は何もしない', () => {
    const m0 = setup();
    expect(update(m0, { type: 'Undo' })).toBe(m0);
    expect(update(m0, { type: 'Redo' })).toBe(m0);
  });
});

describe('テキスト編集', () => {
  it('内容が変わらなければ履歴に積まない', () => {
    const m0 = setup();
    const title = el(m0, 0);
    const m = run(m0, { type: 'EditRequested', id: title.id }, { type: 'TextCommitted', id: title.id, html: title.html });
    expect(m.editingId).toBeNull();
    expect(m.history.past).toHaveLength(0);
  });

  it('変われば1件積み、戻せる', () => {
    const m0 = setup();
    const title = el(m0, 0);
    const m = run(m0, { type: 'EditRequested', id: title.id }, { type: 'TextCommitted', id: title.id, html: '新' });
    expect(el(m, 0).html).toBe('新');
    expect(el(update(m, { type: 'Undo' }), 0).html).toBe(title.html);
  });

  it('画像は編集モードにならない', () => {
    const m0 = setup();
    expect(update(m0, { type: 'EditRequested', id: el(m0, 3).id }).editingId).toBeNull();
  });

  it('編集中のキー操作・Undo は無視する（文字入力やブラウザの undo に任せる）', () => {
    const m0 = setup();
    const m1 = run(m0, { type: 'ElementSelected', id: el(m0, 2).id }, { type: 'KeyPressed', key: 'Delete', shift: false, mod: false });
    const editing = update(m1, { type: 'EditRequested', id: el(m1, 0).id });
    expect(update(editing, { type: 'KeyPressed', key: 'Delete', shift: false, mod: false })).toBe(editing);
    expect(update(editing, { type: 'Undo' })).toBe(editing);
  });
});

describe('スライドが 0 枚', () => {
  it('キー操作やスライド選択で落ちない', () => {
    const m0 = initModel(parseDeck('<body></body>'), 'empty.html');
    const m = run(
      m0,
      { type: 'KeyPressed', key: 'ArrowDown', shift: false, mod: false },
      { type: 'SlideSelected', index: 3 },
      { type: 'Undo' },
    );
    expect(m.current).toBe(0);
  });
});
