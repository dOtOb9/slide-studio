// ツールバーの「挿入」ボタン群（view）。plugin.ts で reactView に包んでツールバーに置く。
// store は import せず、Model と dispatch を props で受け取る（plugin-api/react.tsx の PluginViewProps）。

import type { PluginViewProps } from '../../plugin-api/react';
import type { ShapeKind } from './update';

const BUTTONS: { shape: ShapeKind; label: string; title: string }[] = [
  { shape: 'text', label: 'テキスト', title: 'テキストボックスを挿入' },
  { shape: 'rect', label: '■ 四角', title: '四角を挿入' },
  { shape: 'ellipse', label: '● 円', title: '円を挿入' },
  { shape: 'arrow', label: '→ 矢印', title: '矢印を挿入' },
];

export function ShapesToolbar({ model, dispatch }: PluginViewProps) {
  const hasSlide = model.deck.slides.length > 0;
  return (
    <>
      {BUTTONS.map((b) => (
        <button
          key={b.shape}
          className="button"
          disabled={!hasSlide}
          onClick={() => dispatch({ type: 'shapes/Inserted', shape: b.shape })}
          title={b.title}
        >
          {b.label}
        </button>
      ))}
    </>
  );
}
