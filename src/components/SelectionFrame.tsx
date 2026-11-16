// 選択中の要素を囲む枠と、リサイズ用の 8 つのハンドル。
// 計算は model/geometry.ts の resizeRect に任せ、ここはマウス操作の受け付けだけを行う。

import { useRef, type PointerEvent } from 'react';
import { HANDLES, resizeRect, type Handle } from '../model/geometry';
import type { Rect } from '../model/types';

interface Props {
  box: Rect; // 選択中の要素の位置とサイズ（スライド px）
  scale: number;
  showHandles: boolean; // テキスト編集中は枠だけ出す
  keepRatio: boolean; // 角のハンドルで縦横比を保つか（画像など）
  onResize: (rect: Partial<Rect>) => void;
}

export function SelectionFrame({ box, scale, showHandles, keepRatio, onResize }: Props) {
  // リサイズ中の情報（押した時のマウス位置と、要素の位置・サイズ）
  const dragRef = useRef<{ handle: Handle; pointerX: number; pointerY: number; box: Rect } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>, handle: Handle) => {
    e.stopPropagation(); // 背景クリック（選択解除）として扱わせない
    dragRef.current = { handle, pointerX: e.clientX, pointerY: e.clientY, box };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.pointerX) / scale;
    const dy = (e.clientY - d.pointerY) / scale;
    // Shift を押している間は、縦横比を保つかどうかを反転させる（PowerPoint と同じ）
    onResize(resizeRect(d.box, d.handle, dx, dy, keepRatio !== e.shiftKey));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      className="selection-frame"
      style={{ left: box.x * scale, top: box.y * scale, width: box.w * scale, height: box.h * scale }}
    >
      {showHandles &&
        HANDLES.map((h) => (
          <div
            key={h.name}
            className={`handle handle-${h.name}`}
            style={{ left: `${(h.hx + 1) * 50}%`, top: `${(h.hy + 1) * 50}%` }}
            onPointerDown={(e) => onPointerDown(e, h)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        ))}
    </div>
  );
}
