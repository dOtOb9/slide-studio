// update と各プラグイン（plugins/）が共通で使う、Model を扱う小さな道具。
// どれも純粋な関数。プラグインには plugin-api/ を通して公開している。

import type { Deck, SlideElement } from '../model/types';
import type { Model } from './model';

const HISTORY_LIMIT = 100; // 元に戻せる回数の上限

/** Deck を変える操作。変わっていれば、変更前の Deck を履歴に積む（変わらなければ Model をそのまま返す） */
export function edit(model: Model, next: Deck): Model {
  if (next === model.deck) return model;
  return pushHistory({ ...model, deck: next }, model.deck);
}

/** 新しい操作をしたら、やり直し（future）は捨てる。これは一般的なエディタと同じ挙動 */
export function pushHistory(model: Model, before: Deck): Model {
  const past = [...model.history.past, before].slice(-HISTORY_LIMIT);
  return { ...model, history: { past, future: [] } };
}

/** ドラッグ中・テキスト編集中は、スライドの増減や挿入など大きな操作を受け付けない */
export function isBusy(model: Model): boolean {
  return model.gesture !== null || model.editingId !== null;
}

/** 表示するスライドを切り替え、選択と編集は解除する */
export function showSlide(model: Model, index: number): Model {
  return { ...model, current: clampSlide(model.deck, index), selectedId: null, editingId: null, gesture: null };
}

/** 新しい id（"n1", "n2", ...）を作りながら Deck を作り、使った分だけ連番を進める */
export function withNewIds<T>(model: Model, fn: (newId: () => string) => T): { result: T; nextId: number } {
  let n = model.nextId;
  const result = fn(() => `n${n++}`);
  return { result, nextId: n };
}

/** 表示中のスライド（スライドが 0 枚なら undefined） */
export function currentSlide(model: Model) {
  return model.deck.slides[model.current];
}

export function currentSlideId(model: Model): string {
  return model.deck.slides[model.current].id;
}

export function findElement(model: Model, id: string) {
  return model.deck.slides[model.current]?.elements.find((e) => e.id === id);
}

/**
 * テキスト編集（contentEditable）に入れる要素か。
 * 画像と SVG は contentEditable が効かず、フォーカスもできないので、編集に入ると抜けられなくなる
 */
export function isTextEditable(el: SlideElement): boolean {
  return el.tag !== 'img' && el.tag !== 'svg';
}

/** プラグイン自身の状態を読む（まだ書いていなければ undefined） */
export function getPluginState<T>(model: Model, name: string): T | undefined {
  return model.plugins[name] as T | undefined;
}

/** プラグイン自身の状態を書く。同じ値なら Model をそのまま返す */
export function setPluginState<T>(model: Model, name: string, state: T): Model {
  if (model.plugins[name] === state) return model;
  return { ...model, plugins: { ...model.plugins, [name]: state } };
}

export function clampSlide(deck: Deck, index: number): number {
  return Math.max(0, Math.min(deck.slides.length - 1, index));
}
