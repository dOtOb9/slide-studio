// デッキを編集する関数群。
// どれも「古い Deck を受け取り、新しい Deck を返す」。元のデータは書き換えない（イミュータブル）。
//   - React は「オブジェクトが別物になったか」で変更を検知するので、再描画が確実に起きる
//   - 古い Deck がそのまま残るので、元に戻す（app/update.ts）は古い Deck を取っておくだけで作れる
//   - 何も変わらなかったときは、元の Deck をそのまま返す。
//     「参照が同じ = 変更なし」と判断できるので、空の履歴を積まずに済む

import type { Deck, Rect, Slide } from './types';

export interface ElementPatch {
  rect?: Partial<Rect>; // 変更する位置・サイズだけを渡す（残りはそのまま）
  html?: string;
}

/** 指定したスライドだけを差し替えた新しい Deck を返す。スライドが変わらなければ元の Deck を返す */
function mapSlide(deck: Deck, slideId: string, fn: (slide: Slide) => Slide): Deck {
  let changed = false;
  const slides = deck.slides.map((s) => {
    if (s.id !== slideId) return s;
    const next = fn(s);
    if (next !== s) changed = true;
    return next;
  });
  return changed ? { ...deck, slides } : deck;
}

/**
 * 位置は整数 px に丸める（ファイルに 123.4567px のような値が残らないように）。
 * NaN や Infinity は計算の不具合なので、ファイルを壊さないよう捨てる。
 */
function roundRect(rect: Partial<Rect>): Partial<Rect> {
  const out: Partial<Rect> = {};
  for (const [k, v] of Object.entries(rect) as [keyof Rect, number][]) {
    if (Number.isFinite(v)) out[k] = Math.round(v);
  }
  return out;
}

function sameRect(a: Partial<Rect>, b: Partial<Rect>): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function updateElement(deck: Deck, slideId: string, elementId: string, patch: ElementPatch): Deck {
  return mapSlide(deck, slideId, (slide) => {
    let changed = false;
    const elements = slide.elements.map((el) => {
      if (el.id !== elementId) return el;
      const rect = patch.rect ? { ...el.rect, ...roundRect(patch.rect) } : el.rect;
      const html = patch.html ?? el.html;
      if (sameRect(rect, el.rect) && html === el.html) return el; // 丸めた結果が同じなら変更なし
      changed = true;
      return { ...el, rect, html };
    });
    return changed ? { ...slide, elements } : slide;
  });
}

export function deleteElement(deck: Deck, slideId: string, elementId: string): Deck {
  return mapSlide(deck, slideId, (slide) => {
    const elements = slide.elements.filter((el) => el.id !== elementId);
    return elements.length === slide.elements.length ? slide : { ...slide, elements };
  });
}
