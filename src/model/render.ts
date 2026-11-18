import { elementAttrs, elementHtml, styleText, type ResolveSrc } from './serialize';
import type { Deck, Rect, Slide, SlideElement } from './types';

export function resolveRect(deck: Deck, slide: Slide, el: SlideElement): Partial<Rect> {
  const ph = findPlaceholder(deck, slide, el);
  return { ...ph?.rect, ...el.rect };
}

function findPlaceholder(deck: Deck, slide: Slide, el: SlideElement) {
  if (!el.ph) return undefined;
  const layout = deck.layouts.find((l) => l.name === slide.layout);
  return layout?.placeholders.find((p) => p.name === el.ph);
}

const RESET_INHERITED_CSS_THAT_CROSSES_SHADOW_DOM_BOUNDARY = ':host { all: initial; display: block; }';

export function baseCss(deck: Deck): string {
  return `
${RESET_INHERITED_CSS_THAT_CROSSES_SHADOW_DOM_BOUNDARY}
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

export function renderSlideHtml(deck: Deck, slide: Slide, resolveSrc?: ResolveSrc): string {
  const parts = slide.elements.map((el) => {
    const ph = findPlaceholder(deck, slide, el);
    const layoutStyleThenSlideStyleSoSlideWins = [ph?.style, el.style].filter(Boolean).join('; ');
    const style = styleText(resolveRect(deck, slide, el), layoutStyleThenSlideStyleSoSlideWins);
    const attrs: Record<string, string> = { ...elementAttrs(el, resolveSrc), 'data-id': el.id };
    if (el.ph) attrs['data-ph'] = el.ph;
    return elementHtml(el.tag, attrs, style, el.html);
  });
  return `<section data-layout="${slide.layout}">${parts.join('')}</section>`;
}
