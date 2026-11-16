// 選択中の要素を囲む枠と、リサイズ用の 8 つのハンドル。
// 見た目を描くだけ。ハンドルが押されたことを親に知らせ、その後の処理は update に任せる。

import type { PointerEvent } from 'react';
import { HANDLES, type Handle } from '../model/geometry';
import type { Rect } from '../model/types';

interface Props {
  box: Rect; // 選択中の要素の位置とサイズ（スライド px）
  scale: number;
  showHandles: boolean; // テキスト編集中は枠だけ出す
  onHandlePointerDown: (e: PointerEvent<HTMLDivElement>, handle: Handle) => void;
}

export function SelectionFrame({ box, scale, showHandles, onHandlePointerDown }: Props) {
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
            onPointerDown={(e) => onHandlePointerDown(e, h)}
          />
        ))}
    </div>
  );
}
