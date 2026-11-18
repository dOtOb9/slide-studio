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
import { defaultNewLayout, initModel, type Gesture, type Model } from './model';
import type { KeyInput, Msg } from './msg';

const CLICK_JITTER_SLIDE_PX = 4;
const ARROW_STEP_PX = 1;
const ARROW_STEP_WITH_SHIFT_PX = 10;

export function update(model: Model, msg: Msg): Model {
  if (isPluginMsg(msg)) return updatePlugin(model, msg);

  switch (msg.type) {
    case 'DeckLoaded': {
      const pluginStateOutlivesFiles = model.plugins;
      return { ...initModel(msg.deck, msg.fileName), plugins: pluginStateOutlivesFiles, canReadFolder: msg.canReadFolder === true };
    }

    case 'DeckSaved':
      return {
        ...model,
        savedDeck: msg.deck,
        fileName: msg.fileName,
        canReadFolder: msg.canReadFolder ?? model.canReadFolder,
      };

    case 'ImagesAdded': {
      const { images, rejected } = acceptImages(msg.images);
      if (rejected.length > 0) console.error('ImagesAdded の中の、画像のパスと Blob の組でない項目を捨てました', rejected);
      const added = Object.keys(images).filter((path) => !Object.prototype.hasOwnProperty.call(model.images, path));
      if (added.length === 0) return model;
      const existingWinsSinceNameIsContentHash = { ...images, ...model.images };
      return { ...model, images: existingWinsSinceNameIsContentHash };
    }

    case 'SlideSelected': {
      const switchingWouldDropUnfinishedDragFromHistory = model.gesture !== null;
      if (switchingWouldDropUnfinishedDragFromHistory) return model;
      return showSlide(model, msg.index);
    }

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
      const deletedBeforeCurrent = msg.index < model.current;
      return showSlide(edit(model, deck), deletedBeforeCurrent ? model.current - 1 : model.current);
    }

    case 'SlideMoved': {
      if (isBusy(model)) return model;
      const deck = moveSlide(model.deck, msg.from, msg.to);
      if (deck === model.deck) return model;
      const movedSlideIndex = msg.to;
      return showSlide(edit(model, deck), movedSlideIndex);
    }

    case 'NotesCommitted': {
      const slide = model.deck.slides[msg.index];
      if (!slide) return model;
      const notes = trimmedLikeParseReadsNotes(msg.notes);
      const next = setNotes(model.deck, slide.id, notes);
      if (next === model.deck) return model;
      if (model.gesture) return commitNotesAlsoIntoGestureBaseline(model, model.gesture, slide.id, notes, next);
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
      const isJitterOfDoubleClick = !g.handle && !g.moved && Math.hypot(dx, dy) < CLICK_JITTER_SLIDE_PX;
      if (isJitterOfDoubleClick) return model;
      const shiftInvertsKeepRatio = g.keepRatio !== msg.shift;
      const rect = g.handle
        ? resizeRect(g.origin, g.handle, dx, dy, shiftInvertsKeepRatio)
        : { x: g.origin.x + dx, y: g.origin.y + dy };
      return { ...patchElement(model, g.id, { rect }), gesture: { ...g, moved: true } };
    }

    case 'DragEnded': {
      const g = model.gesture;
      if (!g) return model;
      const ended = { ...model, gesture: null };
      const endedWhereItStarted = model.deck === g.before || sameElement(model, g.before, model.deck, g.id);
      if (endedWhereItStarted) return { ...ended, deck: g.before };
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
      const keyIsTypingOrDuringDrag = model.editingId !== null || model.gesture !== null;
      if (keyIsTypingOrDuringDrag) return model;
      return coreKeyOrNullForPlugins(model, msg) ?? pluginKey(model, msg, update) ?? model;
    }

    case 'BoxesMeasured':
      return { ...model, boxes: msg.boxes };

    case 'Undo':
      return undo(model);

    case 'Redo':
      return redo(model);

    default:
      return assertNever(msg);
  }
}

function coreKeyOrNullForPlugins(model: Model, { key, shift, mod }: KeyInput): Model | null {
  const k = key.toLowerCase();
  if (mod && k === 'z') return shift ? redo(model) : undo(model);
  if (mod && k === 'y') return redo(model);
  if (mod && k === 'm') return update(model, { type: 'SlideAdded', after: model.current, layout: defaultNewLayout(model) });
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
      const measuredBox = model.boxes.find((b) => b.id === el.id);
      if (!measuredBox) return model;
      const step = shift ? ARROW_STEP_WITH_SHIFT_PX : ARROW_STEP_PX;
      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
      const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
      return edit(model, updateElement(model.deck, currentSlideId(model), el.id, { rect: { x: measuredBox.x + dx, y: measuredBox.y + dy } }));
    }
    return null;
  }

  if (key === 'ArrowDown' || key === 'PageDown') return update(model, { type: 'SlideSelected', index: model.current + 1 });
  if (key === 'ArrowUp' || key === 'PageUp') return update(model, { type: 'SlideSelected', index: model.current - 1 });
  return null;
}

function undo(model: Model): Model {
  const { past, future } = model.history;
  if (past.length === 0 || model.gesture || model.editingId) return model;
  return restoreShowingFirstChangedSlide(model, past[past.length - 1], { past: past.slice(0, -1), future: [model.deck, ...future] });
}

function redo(model: Model): Model {
  const { past, future } = model.history;
  if (future.length === 0 || model.gesture || model.editingId) return model;
  return restoreShowingFirstChangedSlide(model, future[0], { past: [...past, model.deck], future: future.slice(1) });
}

function firstSlideWhoseObjectDiffers(a: Deck, b: Deck): number {
  return a.slides.findIndex((s, i) => s !== b.slides[i]);
}

function restoreShowingFirstChangedSlide(model: Model, deck: Deck, history: Model['history']): Model {
  const changed = firstSlideWhoseObjectDiffers(deck, model.deck);
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

function trimmedLikeParseReadsNotes(notes: string): string {
  return notes.trim();
}

function commitNotesAlsoIntoGestureBaseline(model: Model, g: Gesture, slideId: string, notes: string, next: Deck): Model {
  return {
    ...pushHistory(model, g.before),
    deck: next,
    gesture: { ...g, before: setNotes(g.before, slideId, notes) },
  };
}
