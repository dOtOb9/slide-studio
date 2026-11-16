// Deck → HTML 文字列への変換（保存用）。
// 人間や AI が読みやすいよう、インデントを揃えて書き出す。

import { isImagePath } from './images';
import { GEOMETRY } from './parse';
import type { Deck, Rect, SlideElement } from './types';

/** 閉じタグを持たない要素 */
const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'source']);

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** 要素の中に書く文字の、HTML として特別な意味を持つ記号を無害にする */
export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

/**
 * 画像の src を差し替える関数。images/ の画像パス（model/images.ts の管理対象）を受け取り、
 * 実際に使う src（表示用の Blob URL、埋め込み用の data URI など）を返す
 */
export type ResolveSrc = (path: string) => string;

/**
 * 要素の属性。img 要素の src が管理対象の画像パスなら、resolveSrc で差し替える。
 * それ以外の src（data URI、外部の URL、管理対象外のパス）は触らない
 */
export function elementAttrs(el: SlideElement, resolveSrc?: ResolveSrc): Record<string, string> {
  if (!resolveSrc || el.tag !== 'img' || !isImagePath(el.attrs.src)) return el.attrs;
  return { ...el.attrs, src: resolveSrc(el.attrs.src) };
}

function serializeElement(el: SlideElement, resolveSrc?: ResolveSrc): string {
  const attrs: Record<string, string> = el.ph ? { 'data-ph': el.ph } : { 'data-el': '' };
  Object.assign(attrs, elementAttrs(el, resolveSrc));
  return elementHtml(el.tag, attrs, styleText(el.rect, el.style), el.html);
}

/**
 * Deck を deck.html の文字列にする。
 * resolveSrc を渡すと、images/ の画像の src を差し替えて書く（画像を data URI で埋め込んだ1ファイルを作るとき）。
 * 省略すれば src はそのまま
 */
export function serializeDeck(deck: Deck, resolveSrc?: ResolveSrc): string {
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
    for (const el of slide.elements) out.push('  ' + serializeElement(el, resolveSrc));
    if (slide.notes) out.push(`  <aside data-notes>${escapeText(slide.notes)}</aside>`);
    out.push('</section>');
  }

  out.push('</body>');
  out.push('</html>');
  return out.join('\n') + '\n';
}
