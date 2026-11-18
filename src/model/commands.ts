import type { Deck, Rect, Slide, SlideElement } from './types';

export interface ElementPatch {
  rect?: Partial<Rect>;
  html?: string;
}

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

function toWholePxDroppingNonFinite(rect: Partial<Rect>): Partial<Rect> {
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
      const rect = patch.rect ? { ...el.rect, ...toWholePxDroppingNonFinite(patch.rect) } : el.rect;
      const html = patch.html ?? el.html;
      const unchangedAfterRounding = sameRect(rect, el.rect) && html === el.html;
      if (unchangedAfterRounding) return el;
      changed = true;
      return { ...el, rect, html };
    });
    return changed ? { ...slide, elements } : slide;
  });
}

export const ADD_SLIDE_AT_TOP = -1;

export function addSlide(deck: Deck, afterIndex: number, layoutName: string, newId: () => string): Deck {
  const layout = deck.layouts.find((l) => l.name === layoutName);
  const slide: Slide = {
    id: newId(),
    layout: layoutName,
    notes: '',
    elements: (layout?.placeholders ?? []).map((ph) => ({
      id: newId(),
      tag: 'div',
      ph: ph.name,
      rect: {},
      style: '',
      attrs: {},
      html: '',
    })),
  };
  const slides = [...deck.slides];
  slides.splice(afterIndex + 1, 0, slide);
  return { ...deck, slides };
}

export function duplicateSlide(deck: Deck, index: number, newId: () => string): Deck {
  const src = deck.slides[index];
  if (!src) return deck;
  const copy: Slide = {
    ...src,
    id: newId(),
    elements: src.elements.map((el) => ({ ...el, id: newId(), rect: { ...el.rect }, attrs: { ...el.attrs } })),
  };
  const slides = [...deck.slides];
  slides.splice(index + 1, 0, copy);
  return { ...deck, slides };
}

export function deleteSlide(deck: Deck, index: number): Deck {
  if (!deck.slides[index]) return deck;
  return { ...deck, slides: deck.slides.filter((_, i) => i !== index) };
}

export function moveSlide(deck: Deck, from: number, toIndexAfterRemoval: number): Deck {
  const n = deck.slides.length;
  if (from === toIndexAfterRemoval || from < 0 || from >= n || toIndexAfterRemoval < 0 || toIndexAfterRemoval >= n) return deck;
  const slides = [...deck.slides];
  const [moved] = slides.splice(from, 1);
  slides.splice(toIndexAfterRemoval, 0, moved);
  return { ...deck, slides };
}

export function setNotes(deck: Deck, slideId: string, notes: string): Deck {
  return mapSlide(deck, slideId, (slide) => (slide.notes === notes ? slide : { ...slide, notes }));
}

export function insertElement(deck: Deck, slideId: string, element: SlideElement): Deck {
  return mapSlide(deck, slideId, (slide) => ({ ...slide, elements: [...slide.elements, element] }));
}

export function isEmptyHtml(html: string): boolean {
  return html.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/g, '').trim() === '';
}

export function deleteElement(deck: Deck, slideId: string, elementId: string): Deck {
  return mapSlide(deck, slideId, (slide) => {
    const elements = slide.elements.filter((el) => el.id !== elementId);
    return elements.length === slide.elements.length ? slide : { ...slide, elements };
  });
}
