// スライド1枚を、指定した表示幅に縮小して描画する。
// Shadow DOM の中に描くので、テーマ CSS がアプリの UI に漏れない（逆も同じ）。

import { useLayoutEffect, useRef } from 'react';
import { baseCss, renderSlideHtml } from '../model/render';
import type { Deck, Slide } from '../model/types';

interface Props {
  deck: Deck;
  slide: Slide;
  width: number; // 画面上の表示幅（px）
  /** 描画し終えた直後に呼ばれる。編集キャンバスが要素の位置を測るのに使う */
  onRender?: (root: ShadowRoot) => void;
}

export function SlideView({ deck, slide, width, onRender }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scale = width / deck.width;

  // useLayoutEffect: 画面に表示される前に実行される useEffect。
  // ここで描画→位置の測定まで済ませるので、ちらつきが出ない
  useLayoutEffect(() => {
    const host = hostRef.current!;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${baseCss(deck)}\n${deck.css}</style>${renderSlideHtml(deck, slide)}`;
    onRender?.(root);
  }, [deck, slide, onRender]);

  return (
    // 外枠: 縮小後の大きさで場所を確保する
    <div style={{ width, height: deck.height * scale, overflow: 'hidden' }}>
      {/* 中身: 1920x1080 のまま描いて transform で縮小する */}
      <div
        ref={hostRef}
        style={{ width: deck.width, height: deck.height, transform: `scale(${scale})`, transformOrigin: '0 0' }}
      />
    </div>
  );
}
