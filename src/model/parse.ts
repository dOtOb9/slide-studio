// HTML 文字列 → Deck への変換。
// ブラウザ標準の DOMParser で HTML を解析し、必要な情報だけを取り出す。

import type { Deck, Layout, Placeholder, Rect, Slide, SlideElement } from './types';

/** Rect のキーと CSS プロパティの対応 */
export const GEOMETRY: Record<keyof Rect, string> = {
  x: 'left',
  y: 'top',
  w: 'width',
  h: 'height',
};

/** ファイルには保存しない属性（アプリが別の欄で管理するもの） */
const MANAGED_ATTRS = new Set(['style', 'data-ph', 'data-el']);

let seq = 0;
export const newId = (prefix = 'e') => `${prefix}${++seq}`;

function parsePx(value: string): number | undefined {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return m ? Number(m[1]) : undefined;
}

/**
 * 要素の style から left/top/width/height(px) を取り出し、
 * 残りのスタイルを文字列で返す。
 */
function splitStyle(el: Element): { rect: Partial<Rect>; style: string } {
  const rect: Partial<Rect> = {};
  const style = (el as HTMLElement).style;
  for (const [key, prop] of Object.entries(GEOMETRY) as [keyof Rect, string][]) {
    const v = parsePx(style.getPropertyValue(prop));
    if (v !== undefined) {
      rect[key] = v;
      style.removeProperty(prop);
    }
  }
  return { rect, style: (el.getAttribute('style') ?? '').trim() };
}

function otherAttrs(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) {
    if (!MANAGED_ATTRS.has(a.name)) attrs[a.name] = a.value;
  }
  return attrs;
}

function parseLayout(tpl: HTMLTemplateElement): Layout {
  const placeholders: Placeholder[] = [];
  for (const el of Array.from(tpl.content.querySelectorAll('[data-ph]'))) {
    const { rect, style } = splitStyle(el);
    placeholders.push({ name: el.getAttribute('data-ph')!, rect, style });
  }
  return { name: tpl.getAttribute('data-layout')!, placeholders };
}

function parseElement(el: Element): SlideElement {
  const { rect, style } = splitStyle(el);
  return {
    id: newId(),
    tag: el.tagName.toLowerCase(),
    ph: el.getAttribute('data-ph') ?? undefined,
    rect,
    style,
    attrs: otherAttrs(el),
    html: el.innerHTML.trim(),
  };
}

/** 発表者ノートの要素か（スライド上の要素としては扱わない） */
const isNotes = (el: Element) => el.tagName === 'ASIDE' && el.hasAttribute('data-notes');

function parseSlide(section: Element): Slide {
  const children = Array.from(section.children);
  return {
    id: newId('s'),
    layout: section.getAttribute('data-layout') ?? 'blank',
    // section の直下の要素は、ノート以外すべてスライド上の要素として扱う。
    // data-el が付いていなくても受け入れる（AI が付け忘れても壊れないように）
    elements: children.filter((el) => !isNotes(el)).map(parseElement),
    // ノートはプレーンテキストとして読む（タグが書かれていても文字だけを取り出す）
    notes: children.find(isNotes)?.textContent?.trim() ?? '',
  };
}

export function parseDeck(html: string): Deck {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const size = doc.querySelector('meta[name="slide-size"]')?.getAttribute('content') ?? '1920x1080';
  const [width, height] = size.split('x').map(Number);

  const css = Array.from(doc.querySelectorAll('style'))
    .map((s) => s.textContent?.trim() ?? '')
    .join('\n\n');

  const layouts = Array.from(doc.querySelectorAll<HTMLTemplateElement>('template[data-layout]')).map(
    parseLayout,
  );

  const slides = Array.from(doc.querySelectorAll('body > section')).map(parseSlide);

  return { width, height, css, layouts, slides };
}
