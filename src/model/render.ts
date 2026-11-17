// スライド1枚を「表示用の HTML」に変換する。
// プレースホルダーの位置をレイアウトから解決し、すべての要素を絶対配置にする。
// 画面表示・サムネイル・（将来の）PDF 書き出しで同じ関数を使うので、見た目が一致する。

import { elementAttrs, elementHtml, styleText, type ResolveSrc } from './serialize';
import type { Deck, Rect, Slide, SlideElement } from './types';

/** 要素の最終的な位置 = レイアウトの位置 + スライド側の上書き */
export function resolveRect(deck: Deck, slide: Slide, el: SlideElement): Partial<Rect> {
  const ph = findPlaceholder(deck, slide, el);
  return { ...ph?.rect, ...el.rect };
}

function findPlaceholder(deck: Deck, slide: Slide, el: SlideElement) {
  if (!el.ph) return undefined;
  const layout = deck.layouts.find((l) => l.name === slide.layout);
  return layout?.placeholders.find((p) => p.name === el.ph);
}

/** スライドの外枠と、全要素に共通の基本スタイル */
export function baseCss(deck: Deck): string {
  return `
/* 継承する CSS（text-align, color など）は Shadow DOM の境界を越えてくるので、ここで全部リセット */
:host { all: initial; display: block; }
section {
  position: relative;
  width: ${deck.width}px;
  height: ${deck.height}px;
  overflow: hidden;
  background: #fff;
}
section > * { position: absolute; box-sizing: border-box; margin: 0; }
`;
}

/**
 * スライド1枚の表示用 HTML。
 * resolveSrc を渡すと、images/ の画像の src を差し替える（編集画面とサムネイルは Blob URL にする）。
 * 省略すれば src はそのまま（ブラウザは images/... を、アプリのページからの相対パスとして読みに行く）
 */
export function renderSlideHtml(deck: Deck, slide: Slide, resolveSrc?: ResolveSrc): string {
  const parts = slide.elements.map((el) => {
    const ph = findPlaceholder(deck, slide, el);
    // レイアウト側のスタイル（枠線など）→ スライド側のスタイルの順に並べ、後者を優先させる
    const style = styleText(resolveRect(deck, slide, el), [ph?.style, el.style].filter(Boolean).join('; '));
    const attrs: Record<string, string> = { ...elementAttrs(el, resolveSrc), 'data-id': el.id };
    if (el.ph) attrs['data-ph'] = el.ph;
    return elementHtml(el.tag, attrs, style, el.html);
  });
  return `<section data-layout="${slide.layout}">${parts.join('')}</section>`;
}
