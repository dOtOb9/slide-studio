// 状態の更新（Elm でいう update）。
// update(model, msg) は「今の Model と起きた出来事から、次の Model を返す」純粋な関数。
// DOM にも React にも触らないので、Msg を順に流すだけでテストできる。

import {
  addSlide,
  deleteElement,
  deleteSlide,
  duplicateSlide,
  moveSlide,
  setNotes,
  updateElement,
  type ElementPatch,
} from '../model/commands';
import { resizeRect } from '../model/geometry';
import { acceptImages } from '../model/images';
import type { Deck } from '../model/types';
import { isPluginMsg, pluginKey, updatePlugin } from '../plugins/host';
import {
  clampSlide,
  currentSlideId,
  edit,
  findElement,
  isBusy,
  isTextEditable,
  pushHistory,
  showSlide,
  withNewIds,
} from './helpers';
import { defaultNewLayout, initModel, type Model } from './model';
import type { KeyInput, Msg } from './msg';

const DRAG_THRESHOLD = 4; // これ未満の移動（スライド px）はクリックとみなす

export function update(model: Model, msg: Msg): Model {
  // 各プラグイン（plugins/）の Msg は "プラグイン名/出来事" という type を持つ。そのプラグインの update に任せる
  if (isPluginMsg(msg)) return updatePlugin(model, msg);

  switch (msg.type) {
    case 'DeckLoaded':
      // プラグイン自身の状態は、ファイルの中身ではないので引き継ぐ。画像（images）は別のファイルのものなので空にする
      return { ...initModel(msg.deck, msg.fileName), plugins: model.plugins, canReadFolder: msg.canReadFolder === true };

    case 'DeckSaved':
      // 保存中に編集が続いていても正しく判定できるよう、「保存した時点の」Deck を覚える
      return {
        ...model,
        savedDeck: msg.deck,
        fileName: msg.fileName,
        canReadFolder: msg.canReadFolder ?? model.canReadFolder,
      };

    case 'ImagesAdded': {
      // 外から来る値（プラグインの部品も送る）: キーが画像のパスで、値が Blob の項目だけを受け入れる
      const { images, rejected } = acceptImages(msg.images);
      if (rejected.length > 0) console.error('ImagesAdded の中の、画像のパスと Blob の組でない項目を捨てました', rejected);
      // すでに持っている画像は上書きしない（名前が中身から決まるので、同じ名前なら同じ中身のはず）
      const added = Object.keys(images).filter((path) => !Object.prototype.hasOwnProperty.call(model.images, path));
      if (added.length === 0) return model;
      return { ...model, images: { ...images, ...model.images } };
    }

    case 'SlideSelected':
      // ドラッグ中に切り替えると、途中まで動かした分が履歴に残らなくなるので無視する
      if (model.gesture) return model;
      return showSlide(model, msg.index);

    case 'SlideAdded': {
      if (isBusy(model)) return model;
      const { result: deck, nextId } = withNewIds(model, (newId) => addSlide(model.deck, msg.after, msg.layout, newId));
      return showSlide({ ...edit(model, deck), nextId }, msg.after + 1);
    }

    case 'SlideDuplicated': {
      if (isBusy(model)) return model;
      const { result: deck, nextId } = withNewIds(model, (newId) => duplicateSlide(model.deck, msg.index, newId));
      if (deck === model.deck) return model;
      return showSlide({ ...edit(model, deck), nextId }, msg.index + 1);
    }

    case 'SlideDeleted': {
      if (isBusy(model)) return model;
      const deck = deleteSlide(model.deck, msg.index);
      if (deck === model.deck) return model;
      // 表示中より前を消したら、表示中のスライドは1つ前にずれる
      return showSlide(edit(model, deck), msg.index < model.current ? model.current - 1 : model.current);
    }

    case 'SlideMoved': {
      if (isBusy(model)) return model;
      const deck = moveSlide(model.deck, msg.from, msg.to);
      if (deck === model.deck) return model;
      // 並べ替えた後も、動かしたスライドを表示する
      return showSlide(edit(model, deck), msg.to);
    }

    case 'NotesCommitted': {
      const slide = model.deck.slides[msg.index];
      if (!slide) return model;
      // 読み込み時に前後の空白を除くので、確定時も同じにする（保存して開き直しても変わらないように）
      const notes = msg.notes.trim();
      const next = setNotes(model.deck, slide.id, notes);
      if (next === model.deck) return model;
      const g = model.gesture;
      if (g) {
        // ドラッグ中にノートが確定した場合（通常は view が先に確定させるので起きないが、念のため）:
        // ドラッグの開始前の Deck にもノートを反映しておく。そうしないと、要素が動かなかったときに
        // DragEnded が開始前の Deck に戻し、ノートが消えてしまう。
        // 履歴には「ノートを変える前」を1件積み、ノートの変更だけを戻せるようにする
        return {
          ...pushHistory(model, g.before),
          deck: next,
          gesture: { ...g, before: setNotes(g.before, slide.id, notes) },
        };
      }
      return edit(model, next);
    }

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
      // 動かしてから元の位置に戻した場合など、中身が始める前と同じなら履歴に積まない。
      // Deck も始める前のものに戻しておく（参照が同じ = 変更なし、という約束を保つため）
      if (model.deck === g.before || sameElement(model, g.before, model.deck, g.id)) {
        return { ...ended, deck: g.before };
      }
      // 実際に変わっていれば、操作を始める前の Deck を履歴に1件だけ積む
      return pushHistory(ended, g.before);
    }

    case 'EditRequested': {
      const el = findElement(model, msg.id);
      if (!el || !isTextEditable(el) || model.gesture) return model;
      return { ...model, selectedId: msg.id, editingId: msg.id };
    }

    case 'TextCommitted': {
      const done = { ...model, editingId: null };
      const el = findElement(model, msg.id);
      if (!el || el.html === msg.html) return done;
      return edit(done, updateElement(model.deck, currentSlideId(model), msg.id, { html: msg.html }));
    }

    case 'KeyPressed': {
      // テキスト編集中のキーは文字入力に、ドラッグ中のキーは無視
      if (model.editingId || model.gesture) return model;
      // まず共通のキー操作。扱わなかったキーは各プラグインに回す
      return coreKey(model, msg) ?? pluginKey(model, msg, update) ?? model;
    }

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

/** 共通のキー操作。扱わないキーなら null を返す（各プラグインに回すため） */
function coreKey(model: Model, { key, shift, mod }: KeyInput): Model | null {
  const k = key.toLowerCase();
  if (mod && k === 'z') return shift ? redo(model) : undo(model);
  if (mod && k === 'y') return redo(model);
  // Ctrl+M: 新しいスライド（PowerPoint と同じ）
  if (mod && k === 'm') return update(model, { type: 'SlideAdded', after: model.current, layout: defaultNewLayout(model) });
  // Ctrl+D: 要素を選んでいなければスライドの複製
  if (mod && k === 'd' && !model.selectedId) return update(model, { type: 'SlideDuplicated', index: model.current });

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
    return null;
  }

  // 何も選択していなければ ↑↓ でスライド移動
  if (key === 'ArrowDown' || key === 'PageDown') return update(model, { type: 'SlideSelected', index: model.current + 1 });
  if (key === 'ArrowUp' || key === 'PageUp') return update(model, { type: 'SlideSelected', index: model.current - 1 });
  return null;
}

// --- 履歴 -------------------------------------------------------------------

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
 * ただし並べ替えを戻した場合は、動かしたスライドではなく「並びが最初に変わった位置」を表示する
 * （例: 4枚目を先頭へ動かして戻すと、先頭を表示する）。どこが変わったかは見えるので、これで良しとしている。
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

// --- 小さな道具（update 専用。共通のものは helpers.ts） --------------------------

/** 表示中のスライドの、ある要素の位置と中身が2つの Deck で同じか */
function sameElement(model: Model, a: Deck, b: Deck, id: string): boolean {
  const ea = a.slides[model.current]?.elements.find((e) => e.id === id);
  const eb = b.slides[model.current]?.elements.find((e) => e.id === id);
  if (!ea || !eb) return false;
  const ra = ea.rect;
  const rb = eb.rect;
  return ra.x === rb.x && ra.y === rb.y && ra.w === rb.w && ra.h === rb.h && ea.html === eb.html;
}

function patchElement(model: Model, id: string, patch: ElementPatch): Model {
  return { ...model, deck: updateElement(model.deck, currentSlideId(model), id, patch) };
}

function assertNever(x: never): never {
  throw new Error(`扱っていない Msg: ${JSON.stringify(x)}`);
}
