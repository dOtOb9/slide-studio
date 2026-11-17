// 画像の挿入（純粋な関数の部分）。
//
// 流れ（ファイルを受け取ってからの非同期の処理は部品の側。prepare.ts）:
//   1. 部品がファイルを確かめ、元の大きさを測り、中身のハッシュからパス（images/<SHA-256>.<拡張子>）を作る
//   2. 部品が ImagesAdded（土台の Msg）で中身を Model.images に入れる
//   3. 部品が images/Inserted（この Msg）を送り、ここで表示中のスライドに img の要素を置く
// 2 を先に送るので、要素が描かれる時点で中身はもう Model.images にある（壊れた画像が一瞬出ることもない）。
// 念のため、ここでも中身の無いパスは置かない（ImagesAdded が断られた・順番を間違えた部品への備え）。

// プラグインは plugin-api だけを使う（アプリの内部を直接 import しない）。
import {
  currentSlide,
  edit,
  insertElement,
  isBusy,
  isImagePath,
  withNewIds,
  type Deck,
  type Model,
  type SlideElement,
} from '../../plugin-api';
import { fitSize, placeAt } from './layout';

/** 置く画像1枚。width / height は画像の元の大きさ（px。部品が測った値） */
export type ImageToInsert = { path: string; width: number; height: number };

export type ImagesMsg = { type: 'images/Inserted'; images: ImageToInsert[] };

/**
 * 画像を挿入できる状態か（スライドがあり、ドラッグ中・テキスト編集中でない）。
 * update の入口と、部品が貼り付け・ドロップを横取りするかの判断の両方で使う
 */
export function canInsertImages(model: Model): boolean {
  return currentSlide(model) !== undefined && !isBusy(model);
}

/**
 * images/Inserted の images 欄を確かめ、置いてよいものだけを返す（外から来る値。部品は外部のプラグインからも送れる）。
 * 確かめること: 配列であること。各項目がオブジェクトで、path が管理対象の画像パス、width / height が正の有限な数であること。
 * 加えて、中身（Blob）を Model.images に持っていないパスは置かない。
 * 中身が本当にその大きさの画像かまでは確かめない（大きさがずれても表示が伸びるだけで、アプリは落ちないため）
 */
export function acceptInsertions(model: Model, value: unknown): { accepted: ImageToInsert[]; rejected: unknown[] } {
  const accepted: ImageToInsert[] = [];
  const rejected: unknown[] = [];
  if (!Array.isArray(value)) return { accepted, rejected: [value] };
  const isSize = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;
  for (const item of value as unknown[]) {
    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const ok =
      isImagePath(obj.path) &&
      Object.prototype.hasOwnProperty.call(model.images, obj.path) &&
      isSize(obj.width) &&
      isSize(obj.height);
    if (ok) accepted.push({ path: obj.path as string, width: obj.width as number, height: obj.height as number });
    else rejected.push(item);
  }
  return { accepted, rejected };
}

export function updateImages(model: Model, msg: ImagesMsg): Model {
  switch (msg.type) {
    case 'images/Inserted': {
      const slide = currentSlide(model);
      if (!slide || !canInsertImages(model)) return model;
      const { accepted, rejected } = acceptInsertions(model, msg.images);
      if (rejected.length > 0) console.warn('images/Inserted の中の、置けない項目を捨てました', rejected);
      if (accepted.length === 0) return model;

      const deckSize = { width: model.deck.width, height: model.deck.height };
      const { result: elements, nextId } = withNewIds(model, (newId) =>
        accepted.map(
          (image, index): SlideElement => ({
            id: newId(),
            tag: 'img',
            attrs: { src: image.path },
            style: '',
            html: '',
            rect: placeAt(fitSize(image, deckSize), deckSize, index),
          }),
        ),
      );
      // 一度に入れた画像は、まとめて1回の edit にする（元に戻す1回で全部消える）。
      // ユーザーの操作（ファイルを選ぶ・貼り付ける・落とす）は1回なので、履歴も「1操作 = 1件」（AGENTS.md の約束 5）に合わせる。
      // 1枚ずつ消したいときは、選んで Delete で消せる
      let deck: Deck = model.deck;
      for (const element of elements) deck = insertElement(deck, slide.id, element);
      const next = edit(model, deck);
      // 最後に置いた画像（一番上に重なっている）を選択した状態にする。選択は1つだけなので
      return { ...next, nextId, selectedId: elements[elements.length - 1].id };
    }
  }
}
