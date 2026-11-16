// 状態の更新（Elm でいう update）。
// update(model, msg) は「今の Model と起きた出来事から、次の Model を返す」純粋な関数。
// DOM にも React にも触らないので、Msg を順に流すだけでテストできる。

import { deleteElement, updateElement, type ElementPatch } from '../model/commands';
import { resizeRect } from '../model/geometry';
import type { Deck } from '../model/types';
import { initModel, type Model } from './model';
import type { Msg } from './msg';

const HISTORY_LIMIT = 100; // 元に戻せる回数の上限
const DRAG_THRESHOLD = 4; // これ未満の移動（スライド px）はクリックとみなす

export function update(model: Model, msg: Msg): Model {
  switch (msg.type) {
    case 'DeckLoaded':
      return initModel(msg.deck, msg.fileName);

    case 'SlideSelected':
      return {
        ...model,
        current: clampSlide(model.deck, msg.index),
        selectedId: null,
        editingId: null,
        gesture: null,
      };

    case 'ElementSelected':
      return { ...model, selectedId: msg.id };

    case 'DragStarted': {
      if (model.editingId) return model;
      const box = model.boxes.find((b) => b.id === msg.id);
      const el = findElement(model, msg.id);
      if (!box || !el) return model;
      return {
        ...model,
        selectedId: msg.id,
        gesture: {
          id: msg.id,
          handle: msg.handle,
          start: msg.pointer,
          origin: { x: box.x, y: box.y, w: box.w, h: box.h },
          keepRatio: el.tag === 'img',
          moved: false,
          before: model.deck,
        },
      };
    }

    case 'DragMoved': {
      const g = model.gesture;
      if (!g) return model;
      const dx = msg.pointer.x - g.start.x;
      const dy = msg.pointer.y - g.start.y;
      // 移動は、ごく小さな揺れを無視する（ダブルクリックで要素がずれないように）
      if (!g.handle && !g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return model;
      const rect = g.handle
        ? // Shift を押している間は、縦横比を保つかどうかを反転させる（PowerPoint と同じ）
          resizeRect(g.origin, g.handle, dx, dy, g.keepRatio !== msg.shift)
        : { x: g.origin.x + dx, y: g.origin.y + dy };
      // ドラッグ中は履歴に積まない。積むのは DragEnded で1回だけ
      return { ...patchElement(model, g.id, { rect }), gesture: { ...g, moved: true } };
    }

    case 'DragEnded': {
      const g = model.gesture;
      if (!g) return model;
      const ended = { ...model, gesture: null };
      // 実際に変わっていれば、操作を始める前の Deck を履歴に1件だけ積む
      return model.deck === g.before ? ended : pushHistory(ended, g.before);
    }

    case 'EditRequested': {
      const el = findElement(model, msg.id);
      if (!el || el.tag === 'img' || model.gesture) return model;
      return { ...model, selectedId: msg.id, editingId: msg.id };
    }

    case 'TextCommitted': {
      const done = { ...model, editingId: null };
      const el = findElement(model, msg.id);
      if (!el || el.html === msg.html) return done;
      return edit(done, updateElement(model.deck, currentSlideId(model), msg.id, { html: msg.html }));
    }

    case 'KeyPressed':
      return onKey(model, msg);

    case 'BoxesMeasured':
      return { ...model, boxes: msg.boxes };

    case 'Undo':
      return undo(model);

    case 'Redo':
      return redo(model);

    default:
      // Msg の種類を増やしたのにここで扱い忘れると、msg が never 型にならず型エラーになる
      return assertNever(msg);
  }
}

// --- キー操作 ---------------------------------------------------------------

function onKey(model: Model, { key, shift, mod }: { key: string; shift: boolean; mod: boolean }): Model {
  // テキスト編集中のキーは文字入力に、ドラッグ中のキーは無視
  if (model.editingId || model.gesture) return model;

  if (mod && key.toLowerCase() === 'z') return shift ? redo(model) : undo(model);
  if (mod && key.toLowerCase() === 'y') return redo(model);

  const el = model.selectedId ? findElement(model, model.selectedId) : undefined;
  if (el) {
    switch (key) {
      case 'Delete':
      case 'Backspace':
        return { ...edit(model, deleteElement(model.deck, currentSlideId(model), el.id)), selectedId: null };
      case 'Escape':
        return { ...model, selectedId: null };
      case 'Enter':
        return update(model, { type: 'EditRequested', id: el.id });
    }
    if (key.startsWith('Arrow')) {
      // 矢印キーで 1px（Shift で 10px）動かす。起点は実際に表示された位置
      const box = model.boxes.find((b) => b.id === el.id);
      if (!box) return model;
      const step = shift ? 10 : 1;
      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
      const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
      return edit(model, updateElement(model.deck, currentSlideId(model), el.id, { rect: { x: box.x + dx, y: box.y + dy } }));
    }
    return model;
  }

  // 何も選択していなければ ↑↓ でスライド移動
  if (key === 'ArrowDown' || key === 'PageDown') return update(model, { type: 'SlideSelected', index: model.current + 1 });
  if (key === 'ArrowUp' || key === 'PageUp') return update(model, { type: 'SlideSelected', index: model.current - 1 });
  return model;
}

// --- 履歴 -------------------------------------------------------------------

/** Deck を変える操作。変わっていれば、変更前の Deck を履歴に積む */
function edit(model: Model, next: Deck): Model {
  if (next === model.deck) return model;
  return pushHistory({ ...model, deck: next }, model.deck);
}

/** 新しい操作をしたら、やり直し（future）は捨てる。これは一般的なエディタと同じ挙動 */
function pushHistory(model: Model, before: Deck): Model {
  const past = [...model.history.past, before].slice(-HISTORY_LIMIT);
  return { ...model, history: { past, future: [] } };
}

function undo(model: Model): Model {
  const { past, future } = model.history;
  if (past.length === 0 || model.gesture || model.editingId) return model;
  return restore(model, past[past.length - 1], { past: past.slice(0, -1), future: [model.deck, ...future] });
}

function redo(model: Model): Model {
  const { past, future } = model.history;
  if (future.length === 0 || model.gesture || model.editingId) return model;
  return restore(model, future[0], { past: [...past, model.deck], future: future.slice(1) });
}

/**
 * 履歴の Deck に切り替える。変わったスライドへ表示を移す（別のスライドでの変更を戻しても、何が起きたか見えるように）。
 * 変更していないスライドは同じオブジェクトのまま共有されている（commands.ts がそう作る）ので、
 * 「オブジェクトが別物になったスライド」を探せば、変わったスライドがわかる。
 */
function restore(model: Model, deck: Deck, history: Model['history']): Model {
  const changed = deck.slides.findIndex((s, i) => s !== model.deck.slides[i]);
  const current = clampSlide(deck, changed >= 0 ? changed : model.current);
  const stillExists = deck.slides[current]?.elements.some((e) => e.id === model.selectedId);
  return {
    ...model,
    deck,
    history,
    current,
    selectedId: stillExists ? model.selectedId : null,
    editingId: null,
  };
}

// --- 小さな道具 ---------------------------------------------------------------

function currentSlideId(model: Model): string {
  return model.deck.slides[model.current].id;
}

function findElement(model: Model, id: string) {
  return model.deck.slides[model.current]?.elements.find((e) => e.id === id);
}

function patchElement(model: Model, id: string, patch: ElementPatch): Model {
  return { ...model, deck: updateElement(model.deck, currentSlideId(model), id, patch) };
}

function clampSlide(deck: Deck, index: number): number {
  return Math.max(0, Math.min(deck.slides.length - 1, index));
}

function assertNever(x: never): never {
  throw new Error(`扱っていない Msg: ${JSON.stringify(x)}`);
}
