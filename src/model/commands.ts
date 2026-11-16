// デッキを編集する関数群。
// どれも「古い Deck を受け取り、新しい Deck を返す」。元のデータは書き換えない（イミュータブル）。
//   - React は「オブジェクトが別物になったか」で変更を検知するので、再描画が確実に起きる
//   - 古い Deck がそのまま残るので、Step 4 の「元に戻す」は古い Deck を取っておくだけで作れる

import type { Deck, Rect, Slide, SlideElement } from './types';

export interface ElementPatch {
  rect?: Partial<Rect>; // 変更する位置・サイズだけを渡す（残りはそのまま）
  html?: string;
}

/** 指定したスライドだけを差し替えた新しい Deck を返す */
function mapSlide(deck: Deck, slideId: string, fn: (slide: Slide) => Slide): Deck {
  return { ...deck, slides: deck.slides.map((s) => (s.id === slideId ? fn(s) : s)) };
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

export function updateElement(deck: Deck, slideId: string, elementId: string, patch: ElementPatch): Deck {
  return mapSlide(deck, slideId, (slide) => ({
    ...slide,
    elements: slide.elements.map((el): SlideElement => {
      if (el.id !== elementId) return el;
      return {
        ...el,
        rect: patch.rect ? { ...el.rect, ...roundRect(patch.rect) } : el.rect,
        html: patch.html ?? el.html,
      };
    }),
  }));
}

export function deleteElement(deck: Deck, slideId: string, elementId: string): Deck {
  return mapSlide(deck, slideId, (slide) => ({
    ...slide,
    elements: slide.elements.filter((el) => el.id !== elementId),
  }));
}
