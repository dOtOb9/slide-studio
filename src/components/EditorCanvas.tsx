import { useRef, type PointerEvent } from 'react';
import type { Point } from '../app/model';
import { useDispatch, useModel } from '../app/store';
import { useBoxMeasurement } from '../hooks/useBoxMeasurement';
import { useTextEditing } from '../hooks/useTextEditing';
import { isEmptyHtml } from '../model/commands';
import type { Handle } from '../model/geometry';
import { SelectionFrame } from './SelectionFrame';
import { SlideView } from './SlideView';

const PLACEHOLDER_LABELS: Record<string, string> = { title: 'タイトル', subtitle: 'サブタイトル', body: '本文' };
const placeholderLabel = (name: string) => PLACEHOLDER_LABELS[name] ?? name;

const PRIMARY_BUTTON = 0;

function keepFromCountingAsBackgroundClickThatDeselects(e: PointerEvent) {
  e.stopPropagation();
}

function commitFocusedFieldSoItsBlurArrivesBeforeDragStarts() {
  (document.activeElement as HTMLElement | null)?.blur();
}

function keepReceivingMoveAndUpOutsideTheBoxViaCanvas(e: PointerEvent<HTMLDivElement>) {
  e.currentTarget.setPointerCapture(e.pointerId);
}

export function EditorCanvas({ width }: { width: number }) {
  const deck = useModel((m) => m.deck);
  const slide = useModel((m) => m.deck.slides[m.current]);
  const boxes = useModel((m) => m.boxes);
  const images = useModel((m) => m.images);
  const selectedId = useModel((m) => m.selectedId);
  const editingId = useModel((m) => m.editingId);
  const dragging = useModel((m) => m.gesture !== null);
  const dispatch = useDispatch();

  const canvasRef = useRef<HTMLDivElement>(null);
  const { rootRef, onRender } = useBoxMeasurement();
  useTextEditing(rootRef, editingId);

  if (!slide) return null;

  const scale = width / deck.width;

  const toSlidePoint = (e: PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const startDrag = (e: PointerEvent<HTMLDivElement>, id: string, handle: Handle | null) => {
    keepFromCountingAsBackgroundClickThatDeselects(e);
    if (e.button !== PRIMARY_BUTTON) return;
    commitFocusedFieldSoItsBlurArrivesBeforeDragStarts();
    keepReceivingMoveAndUpOutsideTheBoxViaCanvas(e);
    dispatch({ type: 'DragStarted', id, handle, pointer: toSlidePoint(e) });
  };

  const onBackgroundPointerDown = (e: PointerEvent) => {
    const path = e.nativeEvent.composedPath();
    const isCaretMoveInsideEditingText = editingId && path.some((n) => n instanceof HTMLElement && n.dataset.id === editingId);
    if (isCaretMoveInsideEditingText) return;
    dispatch({ type: 'ElementSelected', id: null });
  };

  const selectedBox = boxes.find((b) => b.id === selectedId);

  return (
    <div
      ref={canvasRef}
      className="editor-canvas"
      style={{ width, height: deck.height * scale }}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={(e) => dragging && dispatch({ type: 'DragMoved', pointer: toSlidePoint(e), shift: e.shiftKey })}
      onPointerUp={() => dragging && dispatch({ type: 'DragEnded' })}
      onPointerCancel={() => dragging && dispatch({ type: 'DragEnded' })}
    >
      <SlideView deck={deck} slide={slide} width={width} images={images} onRender={onRender} />

      <div className={editingId ? 'overlay editing' : 'overlay'}>
        {boxes.map((b) => {
          const el = slide.elements.find((x) => x.id === b.id);
          const editorOnlyHint = el?.ph && isEmptyHtml(el.html) && editingId !== el.id ? placeholderLabel(el.ph) : null;
          return (
            <div
              key={b.id}
              className={editorOnlyHint ? 'proxy empty' : 'proxy'}
              style={{ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale }}
              onPointerDown={(e) => startDrag(e, b.id, null)}
              onDoubleClick={() => dispatch({ type: 'EditRequested', id: b.id })}
            >
              {editorOnlyHint && <span className="ph-hint">ダブルクリックして{editorOnlyHint}を入力</span>}
            </div>
          );
        })}

        {selectedBox && (
          <SelectionFrame
            box={selectedBox}
            scale={scale}
            showHandles={!editingId}
            onHandlePointerDown={(e, handle) => startDrag(e, selectedBox.id, handle)}
          />
        )}
      </div>
    </div>
  );
}
