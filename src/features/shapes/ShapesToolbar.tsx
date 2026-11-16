// ツールバーの「挿入」ボタン群（view）。features/toolbar.ts に登録する。
// store は import せず、Model と dispatch を props で受け取る（types.ts の FeatureViewProps）。

import type { FeatureViewProps } from '../types';
import type { ShapeKind } from './update';

const BUTTONS: { shape: ShapeKind; label: string; title: string }[] = [
  { shape: 'text', label: 'テキスト', title: 'テキストボックスを挿入' },
  { shape: 'rect', label: '■ 四角', title: '四角を挿入' },
  { shape: 'ellipse', label: '● 円', title: '円を挿入' },
  { shape: 'arrow', label: '→ 矢印', title: '矢印を挿入' },
];

export function ShapesToolbar({ model, dispatch }: FeatureViewProps) {
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
