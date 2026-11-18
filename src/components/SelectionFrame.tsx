import type { PointerEvent } from 'react';
import { HANDLES, type Handle } from '../model/geometry';
import type { Rect } from '../model/types';

interface Props {
  box: Rect;
  scale: number;
  showHandles: boolean;
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
