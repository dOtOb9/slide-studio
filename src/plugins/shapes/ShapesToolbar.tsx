// ツールバーの「挿入」ボタン群（view）。plugin.ts で reactView に包んでツールバーに置く。
// store は import せず、Model と dispatch を props で受け取る（plugin-api/react.tsx の PluginViewProps）。
//
// 見た目はアプリと同じ共通クラス .icon-button（README「プラグイン」）。説明の文字はツールチップに書く。

import { Circle, MoveRight, Square, Type, type LucideIcon } from 'lucide-react';
import type { PluginViewProps } from '../../plugin-api/react';
import type { ShapeKind } from './update';

const BUTTONS: { shape: ShapeKind; Icon: LucideIcon; label: string }[] = [
  { shape: 'text', Icon: Type, label: 'テキストボックスを挿入' },
  { shape: 'rect', Icon: Square, label: '四角を挿入' },
  { shape: 'ellipse', Icon: Circle, label: '円を挿入' },
  { shape: 'arrow', Icon: MoveRight, label: '矢印を挿入' },
];

export function ShapesToolbar({ model, dispatch }: PluginViewProps) {
  const hasSlide = model.deck.slides.length > 0;
  return (
    <>
      {BUTTONS.map(({ shape, Icon, label }) => (
        <button
          key={shape}
          className="icon-button"
          disabled={!hasSlide}
          onClick={() => dispatch({ type: 'shapes/Inserted', shape })}
          title={label}
          aria-label={label}
        >
          <Icon />
        </button>
      ))}
    </>
  );
}
