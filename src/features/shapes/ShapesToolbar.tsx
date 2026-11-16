// ツールバーの「挿入」ボタン群（view）。

import { useDispatch, useModel } from '../../app/store';
import type { ShapeKind } from './update';

const BUTTONS: { shape: ShapeKind; label: string }[] = [
  { shape: 'text', label: 'テキスト' },
  { shape: 'rect', label: '■ 四角' },
  { shape: 'ellipse', label: '● 円' },
  { shape: 'arrow', label: '→ 矢印' },
];

export function ShapesToolbar() {
  const hasSlide = useModel((m) => m.deck.slides.length > 0);
  const dispatch = useDispatch();
  return (
    <>
      {BUTTONS.map((b) => (
        <button
          key={b.shape}
          className="button"
          disabled={!hasSlide}
          onClick={() => dispatch({ type: 'shapes/Inserted', shape: b.shape })}
          title={`${b.label.replace(/^\S+ /, '')}を挿入`}
        >
          {b.label}
        </button>
      ))}
    </>
  );
}
