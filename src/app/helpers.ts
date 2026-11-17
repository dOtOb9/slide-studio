import type { Deck, SlideElement } from '../model/types';
import type { Model } from './model';

const MAX_UNDO_STEPS = 100;

export function edit(model: Model, next: Deck): Model {
  if (next === model.deck) return model;
  return pushHistory({ ...model, deck: next }, model.deck);
}

export function pushHistory(model: Model, before: Deck): Model {
  const past = [...model.history.past, before].slice(-MAX_UNDO_STEPS);
  const newEditDiscardsRedo: Deck[] = [];
  return { ...model, history: { past, future: newEditDiscardsRedo } };
}

export function isBusy(model: Model): boolean {
  return model.gesture !== null || model.editingId !== null;
}

export function showSlide(model: Model, index: number): Model {
  return { ...model, current: clampSlide(model.deck, index), selectedId: null, editingId: null, gesture: null };
}

export function withNewIds<T>(model: Model, fn: (newId: () => string) => T): { result: T; nextId: number } {
  let n = model.nextId;
  const result = fn(() => `n${n++}`);
  return { result, nextId: n };
}

export function currentSlide(model: Model) {
  return model.deck.slides[model.current];
}

export function currentSlideId(model: Model): string {
  return model.deck.slides[model.current].id;
}

export function findElement(model: Model, id: string) {
  return model.deck.slides[model.current]?.elements.find((e) => e.id === id);
}

const TAGS_WHERE_CONTENT_EDITABLE_TRAPS_FOCUS = new Set(['img', 'svg']);

export function isTextEditable(el: SlideElement): boolean {
  return !TAGS_WHERE_CONTENT_EDITABLE_TRAPS_FOCUS.has(el.tag);
}

export function getPluginState<T>(model: Model, name: string): T | undefined {
  return model.plugins[name] as T | undefined;
}

export function setPluginState<T>(model: Model, name: string, state: T): Model {
  if (model.plugins[name] === state) return model;
  return { ...model, plugins: { ...model.plugins, [name]: state } };
}

export function clampSlide(deck: Deck, index: number): number {
  return Math.max(0, Math.min(deck.slides.length - 1, index));
}
