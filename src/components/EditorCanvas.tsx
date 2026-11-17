// 編集用キャンバス（view）。
//
// 構造（下から順に重なる）:
//   1. SlideView       … 本物のスライド（Shadow DOM 内、縮小表示）
//   2. プロキシ         … 各要素と同じ位置に置いた透明な「つかみ用の箱」
//   3. SelectionFrame  … 選択中の要素の枠とリサイズ用ハンドル
//
// このコンポーネントは「何が起きたか」を Msg にして送るだけで、状態を自分では持たない。
// 送る → update が Model を変える → 再描画 → 位置を測り直す（BoxesMeasured）、という一方通行の流れ。

import { useRef, type PointerEvent } from 'react';
import type { Point } from '../app/model';
import { useDispatch, useModel } from '../app/store';
import { useBoxMeasurement } from '../hooks/useBoxMeasurement';
import { useTextEditing } from '../hooks/useTextEditing';
import { isEmptyHtml } from '../model/commands';
import type { Handle } from '../model/geometry';
import { SelectionFrame } from './SelectionFrame';
import { SlideView } from './SlideView';

/** プレースホルダー名の表示用の言い換え。知らない名前はそのまま出す */
const PLACEHOLDER_LABELS: Record<string, string> = { title: 'タイトル', subtitle: 'サブタイトル', body: '本文' };
const placeholderLabel = (name: string) => PLACEHOLDER_LABELS[name] ?? name;

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

  // スライドが無ければ何も描かない。
  // フックは毎回同じ順番で呼ばれる必要があるので、この return はすべてのフックより後に置く
  if (!slide) return null;

  const scale = width / deck.width;

  /** マウス位置（画面 px）を、スライド座標に変換する */
  const toSlidePoint = (e: PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  /** プロキシ（移動）またはハンドル（リサイズ）が押された */
  const startDrag = (e: PointerEvent<HTMLDivElement>, id: string, handle: Handle | null) => {
    e.stopPropagation(); // 背景クリック（選択解除）として扱わせない
    if (e.button !== 0) return; // 左ボタンだけ
    // ノート欄などに入力中なら、先にフォーカスを外して確定させる。
    // そうしないと、確定（blur）がドラッグの開始より後に届き、順番が入れ替わる
    (document.activeElement as HTMLElement | null)?.blur();
    // ポインタを捕まえておくと、マウスが箱の外に出ても move/up が届き続ける。
    // 届いたイベントは親のキャンバスまで伝わるので、move/up はキャンバス側でまとめて受ける
    e.currentTarget.setPointerCapture(e.pointerId);
    dispatch({ type: 'DragStarted', id, handle, pointer: toSlidePoint(e) });
  };

  const onBackgroundPointerDown = (e: PointerEvent) => {
    // 編集中のテキストの中をクリックした場合は、カーソル移動なので何もしない
    const path = e.nativeEvent.composedPath();
    if (editingId && path.some((n) => n instanceof HTMLElement && n.dataset.id === editingId)) return;
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
          // 中身が空のプレースホルダーには、入力を促す表示を出す（編集画面だけ。書き出しには出ない）
          const el = slide.elements.find((x) => x.id === b.id);
          const hint = el?.ph && isEmptyHtml(el.html) && editingId !== el.id ? placeholderLabel(el.ph) : null;
          return (
            <div
              key={b.id}
              className={hint ? 'proxy empty' : 'proxy'}
              style={{ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale }}
              onPointerDown={(e) => startDrag(e, b.id, null)}
              onDoubleClick={() => dispatch({ type: 'EditRequested', id: b.id })}
            >
              {hint && <span className="ph-hint">ダブルクリックして{hint}を入力</span>}
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
