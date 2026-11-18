import type { Deck, Layout, Placeholder, Rect, Slide, SlideElement } from './types';

export const GEOMETRY: Record<keyof Rect, string> = {
  x: 'left',
  y: 'top',
  w: 'width',
  h: 'height',
};

const ATTRS_KEPT_IN_OTHER_FIELDS_NOT_IN_ATTRS = new Set(['style', 'data-ph', 'data-el']);

let seq = 0;
export const newId = (prefix = 'e') => `${prefix}${++seq}`;

function parsePx(value: string): number | undefined {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  return m ? Number(m[1]) : undefined;
}

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
    if (!ATTRS_KEPT_IN_OTHER_FIELDS_NOT_IN_ATTRS.has(a.name)) attrs[a.name] = a.value;
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

const isNotes = (el: Element) => el.tagName === 'ASIDE' && el.hasAttribute('data-notes');

function parseSlide(section: Element): Slide {
  const children = Array.from(section.children);
  return {
    id: newId('s'),
    layout: section.getAttribute('data-layout') ?? 'blank',
    elements: everyChildExceptNotesEvenWithoutDataEl(children).map(parseElement),
    notes: notesAsPlainTextJoinedByNewline(children),
  };
}

function everyChildExceptNotesEvenWithoutDataEl(children: Element[]): Element[] {
  return children.filter((el) => !isNotes(el));
}

function notesAsPlainTextJoinedByNewline(children: Element[]): string {
  return children
    .filter(isNotes)
    .map((a) => a.textContent?.trim() ?? '')
    .filter(Boolean)
    .join('\n');
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
