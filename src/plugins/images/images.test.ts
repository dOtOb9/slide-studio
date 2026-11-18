import { images } from './plugin';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { initModel, type Model } from '../../app/model';
import type { Msg } from '../../app/msg';
import { update } from '../../app/update';
import { parseDeck } from '../../model/parse';
import sample from '../../samples/sample-deck.html?raw';
import { registerPlugin, setPluginEnabled } from '../host';
import { canInsertImages } from './update';

registerPlugin(images, 'builtin');

const pathOf = (c: string) => `images/${c.repeat(64)}.png`;
const A = pathOf('a');
const B = pathOf('b');
const C = pathOf('c');

function setup(): Model {
  const m = update(initModel(parseDeck(sample), 't.html'), { type: 'SlideSelected', index: 1 });
  const blob = (s: string) => new Blob([s], { type: 'image/png' });
  return update(m, { type: 'ImagesAdded', images: { [A]: blob('a'), [B]: blob('b'), [C]: blob('c') } });
}

const insert = (m: Model, list: unknown): Model => update(m, { type: 'images/Inserted', images: list } as Msg);
const lastElements = (m: Model, n: number) => m.deck.slides[1].elements.slice(-n);

afterEach(() => {
  setPluginEnabled('images', true);
  vi.restoreAllMocks();
});

describe('images/Inserted', () => {
  it('表示中のスライドに img の要素を置き、選択する。縮めて中央に置く。1回の Undo で消え、Model.images は残る', () => {
    const m0 = setup();
    const m = insert(m0, [{ path: A, width: 3840, height: 2160 }]);
    const [added] = lastElements(m, 1);
    expect(m.deck.slides[1].elements.length).toBe(m0.deck.slides[1].elements.length + 1);
    expect(added).toEqual({
      id: 'n1',
      tag: 'img',
      attrs: { src: A },
      style: '',
      html: '',
      rect: { x: 192, y: 108, w: 1536, h: 864 },
    });
    expect(m.selectedId).toBe('n1');
    expect(m.nextId).toBe(2);
    expect(m.history.past.length).toBe(m0.history.past.length + 1);

    const undone = update(m, { type: 'Undo' });
    expect(undone.deck).toBe(m0.deck);
    expect(undone.images).toBe(m.images);
  });

  it('小さい画像は元の大きさのまま', () => {
    const [added] = lastElements(insert(setup(), [{ path: A, width: 200, height: 100 }]), 1);
    expect(added.rect).toEqual({ x: 860, y: 490, w: 200, h: 100 });
  });

  it('複数を一度に入れたら、40px ずつずらして置き、最後の1枚を選択する。履歴は1件（Undo 1回で全部消える）', () => {
    const m0 = setup();
    const m = insert(m0, [
      { path: A, width: 400, height: 300 },
      { path: B, width: 400, height: 300 },
      { path: C, width: 400, height: 300 },
    ]);
    const added = lastElements(m, 3);
    expect(added.map((e) => e.attrs.src)).toEqual([A, B, C]);
    expect(added.map((e) => [e.rect.x, e.rect.y])).toEqual([
      [760, 390],
      [800, 430],
      [840, 470],
    ]);
    expect(m.selectedId).toBe('n3');
    expect(m.nextId).toBe(4);
    expect(m.history.past.length).toBe(m0.history.past.length + 1);
    expect(update(m, { type: 'Undo' }).deck).toBe(m0.deck);
  });

  it('同じ画像を2回入れると、要素は2つになる（中身は1つ）', () => {
    const m = insert(insert(setup(), [{ path: A, width: 10, height: 10 }]), [{ path: A, width: 10, height: 10 }]);
    expect(lastElements(m, 2).map((e) => e.attrs.src)).toEqual([A, A]);
    expect(Object.keys(m.images)).toHaveLength(3);
  });

  it('中身を Model.images に持っていない画像は置かない（ImagesAdded より先に届いた場合など）', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m0 = setup();
    const missing = pathOf('d');
    expect(insert(m0, [{ path: missing, width: 10, height: 10 }])).toBe(m0);
    const m = insert(m0, [
      { path: missing, width: 10, height: 10 },
      { path: A, width: 10, height: 10 },
    ]);
    expect(lastElements(m, 1)[0].attrs.src).toBe(A);
    expect(m.selectedId).toBe('n1');
  });

  it('スライドが 0 枚・テキスト編集中・ドラッグ中は何もしない', () => {
    const item = [{ path: A, width: 10, height: 10 }];
    const empty = update(initModel(parseDeck('<body></body>'), 'e.html'), {
      type: 'ImagesAdded',
      images: { [A]: new Blob(['a']) },
    });
    expect(canInsertImages(empty)).toBe(false);
    expect(insert(empty, item)).toBe(empty);

    const m0 = setup();
    const target = m0.deck.slides[1].elements[0].id;
    const editing = update(m0, { type: 'EditRequested', id: target });
    expect(canInsertImages(editing)).toBe(false);
    expect(insert(editing, item)).toBe(editing);

    const measured = update(m0, { type: 'BoxesMeasured', boxes: [{ id: target, x: 0, y: 0, w: 10, h: 10 }] });
    const dragging = update(measured, { type: 'DragStarted', id: target, handle: null, pointer: { x: 0, y: 0 } });
    expect(canInsertImages(dragging)).toBe(false);
    expect(insert(dragging, item)).toBe(dragging);

    expect(canInsertImages(m0)).toBe(true);
  });
});

describe('images/Inserted の中身を確かめる（外から来る値）', () => {
  it.each([
    ['配列でない', { path: A, width: 1, height: 1 }],
    ['null', null],
    ['文字列', 'images/a.png'],
    ['項目が null', [null]],
    ['項目が数', [1]],
    ['パスが画像のパスでない', [{ path: '../secret.png', width: 1, height: 1 }]],
    ['パスが文字列でない', [{ path: 1, width: 1, height: 1 }]],
    ['大きさが文字列', [{ path: A, width: '100', height: 100 }]],
    ['大きさが NaN', [{ path: A, width: NaN, height: 100 }]],
    ['大きさが無限', [{ path: A, width: Infinity, height: 100 }]],
    ['大きさが 0', [{ path: A, width: 0, height: 100 }]],
    ['大きさが負', [{ path: A, width: 100, height: -1 }]],
    ['大きさが無い', [{ path: A }]],
    ['空の配列', []],
  ])('%s → 何もしない', (_, value) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m0 = setup();
    expect(insert(m0, value)).toBe(m0);
  });

  it('不正な項目が混ざっていても、正しい項目は置く', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = insert(setup(), [{ path: A, width: 'x', height: 1 }, { path: B, width: 10, height: 10 }, null]);
    expect(lastElements(m, 1)[0].attrs.src).toBe(B);
    expect(warn).toHaveBeenCalled();
  });

  it('大きさが中身の本当の大きさと合っているかまでは確かめない（ずれても表示が伸びるだけでアプリは落ちない）', () => {
    const m = insert(setup(), [{ path: A, width: 7, height: 3 }]);
    expect(lastElements(m, 1)[0].attrs.src).toBe(A);
  });
});

describe('有効・無効', () => {
  it('プラグインの一覧で無効にすると、Msg は届かない', () => {
    const m0 = setup();
    setPluginEnabled('images', false);
    expect(insert(m0, [{ path: A, width: 10, height: 10 }])).toBe(m0);
    setPluginEnabled('images', true);
    expect(insert(m0, [{ path: A, width: 10, height: 10 }])).not.toBe(m0);
  });
});
