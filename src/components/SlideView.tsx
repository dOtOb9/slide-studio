import { useLayoutEffect, useRef } from 'react';
import { displaySrcLeavingMissingAsBrokenPath } from '../io/images';
import { baseCss, renderSlideHtml } from '../model/render';
import type { Deck, Slide } from '../model/types';

interface Props {
  deck: Deck;
  slide: Slide;
  width: number;
  images: Record<string, Blob>;
  onRender?: (root: ShadowRoot) => void;
}

export function SlideView({ deck, slide, width, images, onRender }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scale = width / deck.width;

  useLayoutEffect(() => {
    const host = hostRef.current!;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${baseCss(deck)}\n${deck.css}</style>${renderSlideHtml(deck, slide, displaySrcLeavingMissingAsBrokenPath(images))}`;
    onRender?.(root);
  }, [deck, slide, images, onRender]);

  return (
    <div style={{ width, height: deck.height * scale, overflow: 'hidden' }}>
      <div
        ref={hostRef}
        style={{ width: deck.width, height: deck.height, transform: `scale(${scale})`, transformOrigin: '0 0' }}
      />
    </div>
  );
}
