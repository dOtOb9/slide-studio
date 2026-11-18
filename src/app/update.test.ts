import { describe, expect, it } from 'vitest';
import { parseDeck } from '../model/parse';
import { resolveRect } from '../model/render';
import sample from '../samples/sample-deck.html?raw';
import { initModel, isDirty, type Box, type Model } from './model';
import type { Msg } from './msg';
import { update } from './update';

const runMsgsInOrder = (model: Model, ...msgs: Msg[]) => msgs.reduce(update, model);

function showTitleBodySlideWithMeasuredBoxes(): Model {
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
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const circle = el(m0, 2).id;
    const m = runMsgsInOrder(
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
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m = runMsgsInOrder(
      m0,
      { type: 'DragStarted', id: el(m0, 2).id, handle: null, pointer: p(1300, 400) },
      { type: 'DragMoved', pointer: p(1302, 401), shift: false },
      { type: 'DragEnded' },
    );
    expect(m.deck).toBe(m0.deck);
    expect(m.history.past).toHaveLength(0);
  });
});

describe('見た目が変わらない操作は履歴に積まない', () => {
  it('ハンドルを押して動かさずに離す', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m = runMsgsInOrder(
      m0,
      { type: 'DragStarted', id: el(m0, 3).id, handle: { hx: 1, hy: 1 }, pointer: p(0, 0) },
      { type: 'DragMoved', pointer: p(0.2, 0.3), shift: false },
      { type: 'DragEnded' },
    );
    expect(m.deck).toBe(m0.deck);
    expect(m.history.past).toHaveLength(0);
  });

  it('動かしてから元の位置に戻して離す', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m = runMsgsInOrder(
      m0,
      { type: 'DragStarted', id: el(m0, 2).id, handle: null, pointer: p(0, 0) },
      { type: 'DragMoved', pointer: p(50, 50), shift: false },
      { type: 'DragMoved', pointer: p(0, 0), shift: false },
      { type: 'DragEnded' },
    );
    expect(m.history.past).toHaveLength(0);
    expect(m.deck).toBe(m0.deck);
  });
});

describe('ドラッグ中の他の操作', () => {
  it('スライドの切り替えは無視する（途中の変更を履歴から漏らさない）', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const dragging = runMsgsInOrder(
      m0,
      { type: 'DragStarted', id: el(m0, 2).id, handle: null, pointer: p(0, 0) },
      { type: 'DragMoved', pointer: p(50, 0), shift: false },
    );
    expect(update(dragging, { type: 'SlideSelected', index: 0 })).toBe(dragging);
  });

  it('テキスト編集中はドラッグを始めない', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const editing = update(m0, { type: 'EditRequested', id: el(m0, 0).id });
    expect(update(editing, { type: 'DragStarted', id: el(m0, 2).id, handle: null, pointer: p(0, 0) })).toBe(editing);
  });
});

describe('ハンドルでリサイズ', () => {
  it('1回のリサイズは1回の Undo で戻る', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m = runMsgsInOrder(
      m0,
      { type: 'DragStarted', id: el(m0, 2).id, handle: { hx: 1, hy: 0 }, pointer: p(0, 0) },
      { type: 'DragMoved', pointer: p(30, 0), shift: false },
      { type: 'DragMoved', pointer: p(60, 0), shift: false },
      { type: 'DragEnded' },
      { type: 'Undo' },
    );
    expect(m.deck).toBe(m0.deck);
  });

  it('画像は角で縦横比を保ち、Shift で解除できる', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const img = el(m0, 3).id;
    const se = { hx: 1, hy: 1 } as const;
    const keep = runMsgsInOrder(
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
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const moved = runMsgsInOrder(
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
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const id = el(m0, 2).id;
    const m = runMsgsInOrder(
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
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m1 = runMsgsInOrder(m0, { type: 'ElementSelected', id: el(m0, 2).id }, { type: 'KeyPressed', key: 'Delete', shift: false, mod: false });
    expect(m1.deck.slides[2].elements).toHaveLength(3);
    const m2 = update(m1, { type: 'KeyPressed', key: 'z', shift: false, mod: true });
    expect(m2.deck).toBe(m0.deck);
    expect(update(m2, { type: 'KeyPressed', key: 'y', shift: false, mod: true }).deck).toBe(m1.deck);
    expect(update(m2, { type: 'KeyPressed', key: 'Z', shift: true, mod: true }).deck).toBe(m1.deck);
  });

  it('別のスライドを表示中に戻すと、変更があったスライドへ移る', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m = runMsgsInOrder(
      m0,
      { type: 'ElementSelected', id: el(m0, 2).id },
      { type: 'KeyPressed', key: 'Delete', shift: false, mod: false },
      { type: 'SlideSelected', index: 0 },
      { type: 'Undo' },
    );
    expect(m.current).toBe(2);
  });

  it('並べ替えを戻すと、動かしたスライドでなく並びが最初に変わった位置を表示する（どこが変わったかは見えるので、これで良しとしている）', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m = runMsgsInOrder(
      m0,
      { type: 'SlideMoved', from: 3, to: 0 },
      { type: 'SlideSelected', index: 2 },
      { type: 'Undo' },
    );
    expect(m.deck).toBe(m0.deck);
    expect(m.current).toBe(0);
  });

  it('履歴は 100 件まで。古いものから捨てる', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    let m = update(m0, { type: 'ElementSelected', id: el(m0, 2).id });
    const alternateSoEachPressChangesWithoutRemeasuring = (i: number) => (i % 2 ? 'ArrowLeft' : 'ArrowRight');
    for (let i = 0; i < 105; i++) {
      m = update(m, { type: 'KeyPressed', key: alternateSoEachPressChangesWithoutRemeasuring(i), shift: false, mod: false });
    }
    expect(m.history.past).toHaveLength(100);
  });

  it('戻した後も要素が残っていれば選択を保つ', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const id = el(m0, 2).id;
    const m = runMsgsInOrder(m0, { type: 'ElementSelected', id }, { type: 'KeyPressed', key: 'ArrowRight', shift: false, mod: false }, { type: 'Undo' });
    expect(m.selectedId).toBe(id);
  });

  it('履歴が無いときの Undo / Redo は何もしない', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    expect(update(m0, { type: 'Undo' })).toBe(m0);
    expect(update(m0, { type: 'Redo' })).toBe(m0);
  });
});

describe('テキスト編集', () => {
  it('内容が変わらなければ履歴に積まない', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const title = el(m0, 0);
    const m = runMsgsInOrder(m0, { type: 'EditRequested', id: title.id }, { type: 'TextCommitted', id: title.id, html: title.html });
    expect(m.editingId).toBeNull();
    expect(m.history.past).toHaveLength(0);
  });

  it('変われば1件積み、戻せる', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const title = el(m0, 0);
    const m = runMsgsInOrder(m0, { type: 'EditRequested', id: title.id }, { type: 'TextCommitted', id: title.id, html: '新' });
    expect(el(m, 0).html).toBe('新');
    expect(el(update(m, { type: 'Undo' }), 0).html).toBe(title.html);
  });

  it('画像は編集モードにならない', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    expect(update(m0, { type: 'EditRequested', id: el(m0, 3).id }).editingId).toBeNull();
  });

  it('編集中のキー操作・Undo は無視する（文字入力やブラウザの undo に任せる）', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m1 = runMsgsInOrder(m0, { type: 'ElementSelected', id: el(m0, 2).id }, { type: 'KeyPressed', key: 'Delete', shift: false, mod: false });
    const editing = update(m1, { type: 'EditRequested', id: el(m1, 0).id });
    expect(update(editing, { type: 'KeyPressed', key: 'Delete', shift: false, mod: false })).toBe(editing);
    expect(update(editing, { type: 'Undo' })).toBe(editing);
  });
});

describe('キー操作', () => {
  it('Enter で編集開始、Escape で選択解除', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const id = el(m0, 0).id;
    const selected = update(m0, { type: 'ElementSelected', id });
    expect(update(selected, { type: 'KeyPressed', key: 'Enter', shift: false, mod: false }).editingId).toBe(id);
    expect(update(selected, { type: 'KeyPressed', key: 'Escape', shift: false, mod: false }).selectedId).toBeNull();
  });
});

describe('スライドが 0 枚', () => {
  it('キー操作やスライド選択で落ちない', () => {
    const m0 = initModel(parseDeck('<body></body>'), 'empty.html');
    const m = runMsgsInOrder(
      m0,
      { type: 'KeyPressed', key: 'ArrowDown', shift: false, mod: false },
      { type: 'SlideSelected', index: 3 },
      { type: 'Undo' },
    );
    expect(m.current).toBe(0);
  });
});

describe('スライドの操作', () => {
  const ids = (m: Model) => m.deck.slides.map((s) => s.id);

  it('追加すると、新しいスライドを表示し、1回の Undo で消える', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m = update(m0, { type: 'SlideAdded', after: 2, layout: 'title-body' });
    expect(m.deck.slides).toHaveLength(5);
    expect(m.current).toBe(3);
    expect(m.deck.slides[3].elements.map((e) => e.id)).toEqual(['n2', 'n3']);
    expect(m.nextId).toBe(4);
    expect(update(m, { type: 'Undo' }).deck).toBe(m0.deck);
  });

  it('複製・削除・並べ替えのあとも、表示中のスライドが自然な位置にある', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    expect(update(m0, { type: 'SlideDuplicated', index: 2 }).current).toBe(3);
    expect(update(m0, { type: 'SlideDeleted', index: 0 }).current).toBe(1);
    expect(update(m0, { type: 'SlideDeleted', index: 2 }).current).toBe(2);
    const moved = update(m0, { type: 'SlideMoved', from: 2, to: 0 });
    expect(ids(moved)[0]).toBe(ids(m0)[2]);
    expect(moved.current).toBe(0);
  });

  it('最後の1枚を消しても落ちない', () => {
    let m = showTitleBodySlideWithMeasuredBoxes();
    for (let i = 0; i < 4; i++) m = update(m, { type: 'SlideDeleted', index: 0 });
    expect(m.deck.slides).toHaveLength(0);
    expect(m.current).toBe(0);
    expect(update(m, { type: 'Undo' }).deck.slides).toHaveLength(1);
  });

  it('Ctrl+M は表示中と同じレイアウト、表紙からなら2番目のレイアウトで追加する', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const key = { type: 'KeyPressed', key: 'm', shift: false, mod: true } as const;
    expect(update(m0, key).deck.slides[3].layout).toBe('title-body');
    const onCover = update(m0, { type: 'SlideSelected', index: 0 });
    expect(update(onCover, key).deck.slides[1].layout).toBe('title-body');
  });

  it('Ctrl+D は要素を選んでいなければスライドを複製する', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const key = { type: 'KeyPressed', key: 'd', shift: false, mod: true } as const;
    expect(update(m0, key).deck.slides).toHaveLength(5);
    expect(update(update(m0, { type: 'ElementSelected', id: el(m0, 0).id }), key).deck).toBe(m0.deck);
  });

  it('ドラッグ中・編集中はスライドを増減しない', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const editing = update(m0, { type: 'EditRequested', id: el(m0, 0).id });
    expect(update(editing, { type: 'SlideDeleted', index: 0 })).toBe(editing);
    const dragging = update(m0, { type: 'DragStarted', id: el(m0, 2).id, handle: null, pointer: p(0, 0) });
    expect(update(dragging, { type: 'SlideAdded', after: 0, layout: 'blank' })).toBe(dragging);
    expect(update(dragging, { type: 'SlideMoved', from: 0, to: 1 })).toBe(dragging);
  });

  it('並べ替え・複製は1回の Undo で元の Deck に戻る', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    expect(runMsgsInOrder(m0, { type: 'SlideMoved', from: 3, to: 0 }, { type: 'Undo' }).deck).toBe(m0.deck);
    expect(runMsgsInOrder(m0, { type: 'SlideDuplicated', index: 1 }, { type: 'Undo' }).deck).toBe(m0.deck);
  });

  it('DeckLoaded で履歴・連番・保存状態が初期化される', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const busy = runMsgsInOrder(m0, { type: 'SlideAdded', after: 0, layout: 'blank' }, { type: 'SlideAdded', after: 0, layout: 'blank' });
    const loaded = update(busy, { type: 'DeckLoaded', deck: m0.deck, fileName: 'b.html' });
    expect(loaded.history).toEqual({ past: [], future: [] });
    expect(loaded.nextId).toBe(1);
    expect(loaded.savedDeck).toBe(m0.deck);
    expect(isDirty(loaded)).toBe(false);
  });
});

describe('保存状態', () => {
  it('編集すると未保存、保存すると解消、保存時点まで戻しても解消', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    expect(isDirty(m0)).toBe(false);
    const edited = runMsgsInOrder(m0, { type: 'ElementSelected', id: el(m0, 2).id }, { type: 'KeyPressed', key: 'ArrowRight', shift: false, mod: false });
    expect(isDirty(edited)).toBe(true);
    const saved = update(edited, { type: 'DeckSaved', deck: edited.deck, fileName: 'saved.html' });
    expect(isDirty(saved)).toBe(false);
    expect(saved.fileName).toBe('saved.html');
    expect(isDirty(update(saved, { type: 'Undo' }))).toBe(true);
    expect(isDirty(update(edited, { type: 'Undo' }))).toBe(false);
  });

  it('保存中に編集が続いた場合は、保存した時点の Deck を基準にする', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const a = runMsgsInOrder(m0, { type: 'ElementSelected', id: el(m0, 2).id }, { type: 'KeyPressed', key: 'ArrowRight', shift: false, mod: false });
    const editedWhileWriting = update(a, { type: 'KeyPressed', key: 'ArrowLeft', shift: false, mod: false });
    const saved = update(editedWhileWriting, { type: 'DeckSaved', deck: a.deck, fileName: 'x.html' });
    expect(isDirty(saved)).toBe(true);
  });
});

describe('発表者ノート', () => {
  it('確定すると1件だけ履歴に積み、戻せる。同じ内容なら積まない', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m = update(m0, { type: 'NotesCommitted', index: 2, notes: 'メモ' });
    expect(m.deck.slides[2].notes).toBe('メモ');
    expect(m.history.past).toHaveLength(1);
    expect(update(m, { type: 'Undo' }).deck).toBe(m0.deck);
    expect(update(m0, { type: 'NotesCommitted', index: 2, notes: m0.deck.slides[2].notes })).toBe(m0);
  });
});

describe('キー操作の振り分け', () => {
  it('土台も機能も扱わないキーでは Model が変わらない', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    expect(update(m0, { type: 'KeyPressed', key: 'q', shift: false, mod: false })).toBe(m0);
  });
});

describe('発表者ノート（監査で見つかったケース）', () => {
  it('前後の空白は除いて保存する（開き直しても変わらないように）', () => {
    expect(update(showTitleBodySlideWithMeasuredBoxes(), { type: 'NotesCommitted', index: 2, notes: '  メモ\n' }).deck.slides[2].notes).toBe('メモ');
  });

  it('ドラッグの途中でノートが確定しても、要素が動かなければノートは残る', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m = runMsgsInOrder(
      m0,
      { type: 'DragStarted', id: el(m0, 2).id, handle: null, pointer: p(0, 0) },
      { type: 'NotesCommitted', index: 2, notes: 'NEW' },
      { type: 'DragEnded' },
    );
    expect(m.deck.slides[2].notes).toBe('NEW');
    expect(m.history.past).toHaveLength(1);
    expect(update(m, { type: 'Undo' }).deck).toBe(m0.deck);
  });

  it('ドラッグの途中でノートが確定して要素も動いたら、移動とノートを別々に戻せる', () => {
    const m0 = showTitleBodySlideWithMeasuredBoxes();
    const m = runMsgsInOrder(
      m0,
      { type: 'DragStarted', id: el(m0, 2).id, handle: null, pointer: p(0, 0) },
      { type: 'NotesCommitted', index: 2, notes: 'NEW' },
      { type: 'DragMoved', pointer: p(50, 0), shift: false },
      { type: 'DragEnded' },
    );
    const onlyMoveUndone = update(m, { type: 'Undo' });
    expect(onlyMoveUndone.deck.slides[2].notes).toBe('NEW');
    expect(el(onlyMoveUndone, 2).rect.x).toBe(1240);
    const notesUndoneToo = update(onlyMoveUndone, { type: 'Undo' });
    expect(notesUndoneToo.deck).toBe(m0.deck);
  });
});
