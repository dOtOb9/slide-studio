// Deck → HTML 文字列への変換（保存用）。
// 人間や AI が読みやすいよう、インデントを揃えて書き出す。

import { GEOMETRY } from './parse';
import type { Deck, Rect, SlideElement } from './types';

/** 閉じタグを持たない要素 */
const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'source']);

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** rect と残りのスタイルから style 属性の中身を作る */
export function styleText(rect: Partial<Rect>, rest: string): string {
  const parts: string[] = [];
  for (const [key, prop] of Object.entries(GEOMETRY) as [keyof Rect, string][]) {
    const v = rect[key];
    if (v !== undefined) parts.push(`${prop}:${v}px`);
  }
  const restTrim = rest.trim().replace(/;$/, '');
  if (restTrim) parts.push(restTrim);
  return parts.join('; ');
}

/** 開始タグ + 中身 + 終了タグを組み立てる */
export function elementHtml(
  tag: string,
  attrs: Record<string, string>,
  style: string,
  inner: string,
): string {
  let open = `<${tag}`;
  for (const [k, v] of Object.entries(attrs)) {
    open += v === '' ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`;
  }
  if (style) open += ` style="${escapeAttr(style)}"`;
  open += '>';
  return VOID_TAGS.has(tag) ? open : `${open}${inner}</${tag}>`;
}

function serializeElement(el: SlideElement): string {
  const attrs: Record<string, string> = el.ph ? { 'data-ph': el.ph } : { 'data-el': '' };
  Object.assign(attrs, el.attrs);
  return elementHtml(el.tag, attrs, styleText(el.rect, el.style), el.html);
}

export function serializeDeck(deck: Deck): string {
  const out: string[] = [];
  out.push('<!doctype html>');
  out.push('<html lang="ja">');
  out.push('<head>');
  out.push('<meta charset="utf-8">');
  out.push(`<meta name="slide-size" content="${deck.width}x${deck.height}">`);
  out.push('<style>');
  out.push(deck.css);
  out.push('</style>');
  out.push('</head>');
  out.push('<body>');

  for (const layout of deck.layouts) {
    out.push(`<template data-layout="${escapeAttr(layout.name)}">`);
    for (const ph of layout.placeholders) {
      out.push('  ' + elementHtml('div', { 'data-ph': ph.name }, styleText(ph.rect, ph.style), ''));
    }
    out.push('</template>');
  }
  out.push('');

  for (const slide of deck.slides) {
    out.push(`<section data-layout="${escapeAttr(slide.layout)}">`);
    for (const el of slide.elements) out.push('  ' + serializeElement(el));
    out.push('</section>');
  }

  out.push('</body>');
  out.push('</html>');
  return out.join('\n') + '\n';
}
