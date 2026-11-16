// 編集用キャンバス。
//
// 構造（下から順に重なる）:
//   1. SlideView       … 本物のスライド（Shadow DOM 内、縮小表示）
//   2. プロキシ         … 各要素と同じ位置に置いた透明な「つかみ用の箱」。クリック・移動を受け付ける
//   3. SelectionFrame  … 選択中の要素の枠とリサイズ用ハンドル
//
// 操作するとまず store を書き換える。
// store が変わる → SlideView が描き直される → 位置を測り直す → プロキシや枠も動く、という一方通行の流れ。

import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { useDeckStore, type Box } from '../store';
import { SelectionFrame } from './SelectionFrame';
import { SlideView } from './SlideView';

/** 測り直した結果が前回と同じかどうか（同じなら store を更新せず、余計な再描画を避ける） */
function sameBoxes(a: Box[], b: Box[]): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => p.id === b[i].id && p.x === b[i].x && p.y === b[i].y && p.w === b[i].w && p.h === b[i].h)
  );
}

export function EditorCanvas({ width }: { width: number }) {
  const deck = useDeckStore((s) => s.deck);
  const current = useDeckStore((s) => s.current);
  const selectedId = useDeckStore((s) => s.selectedId);
  const editingId = useDeckStore((s) => s.editingId);
  const selectElement = useDeckStore((s) => s.selectElement);
  const startEditing = useDeckStore((s) => s.startEditing);
  const updateElement = useDeckStore((s) => s.updateElement);

  const slide = deck.slides[current];
  const scale = width / deck.width;

  const boxes = useDeckStore((s) => s.boxes);
  const setBoxes = useDeckStore((s) => s.setBoxes);

  const rootRef = useRef<ShadowRoot | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // --- 1. 描画後に、各要素の実際の位置を測る -------------------------------
  // 幅や高さが指定されていない要素（文字数で幅が決まる等）もあるので、データからではなく DOM から測る。
  // offsetLeft などは transform の影響を受けないので、スライド座標の値がそのまま取れる。
  const measure = useCallback(
    (root: ShadowRoot) => {
      rootRef.current = root;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>('section > [data-id]'));
      const read = () => {
        const next = nodes.map((n) => ({
          id: n.dataset.id!,
          x: n.offsetLeft,
          y: n.offsetTop,
          w: n.offsetWidth,
          h: n.offsetHeight,
        }));
        if (!sameBoxes(useDeckStore.getState().boxes, next)) setBoxes(next);
      };
      read();
      // 描画の後で大きさが変わることがある（画像の読み込み完了、Web フォントの適用など）。
      // ResizeObserver で各要素を見張り、大きさが変わったら測り直す
      observerRef.current?.disconnect();
      observerRef.current = new ResizeObserver(read);
      nodes.forEach((n) => observerRef.current!.observe(n));
    },
    [setBoxes],
  );

  // キャンバスが画面から消えるときは見張りをやめる
  useEffect(() => () => observerRef.current?.disconnect(), []);

  // --- 2. 選択と移動（ドラッグ） ---------------------------------------------
  // 「押した位置からマウスがどれだけ動いたか」を scale で割って、押した時点の要素の位置に足すだけ。
  // ドラッグ中の情報は描画に使わないので、state ではなく ref に持つ（変えても再描画が起きない）
  // TODO(Step 3): いまは pointermove のたびに updateElement が走る。undo を入れるときは
  //   pointerdown〜pointerup を「1回の操作」としてまとめ、履歴が1件になるようにする（リサイズも同様）
  const dragRef = useRef<{
    id: string;
    pointerX: number; // 押した時のマウス位置（画面 px）
    pointerY: number;
    x: number; // 押した時の要素の位置（スライド px）
    y: number;
    moved: boolean;
  } | null>(null);

  const onProxyPointerDown = (e: PointerEvent<HTMLDivElement>, box: Box) => {
    e.stopPropagation(); // 背景クリック（選択解除）として扱わせない
    if (e.button !== 0) return; // 左ボタンだけ
    selectElement(box.id);
    dragRef.current = { id: box.id, pointerX: e.clientX, pointerY: e.clientY, x: box.x, y: box.y, moved: false };
    // ポインタを捕まえておくと、マウスが箱の外に出ても move/up がこの要素に届き続ける
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onProxyPointerMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.pointerX;
    const dy = e.clientY - d.pointerY;
    // 3px 未満の揺れはクリック（ダブルクリック）とみなして動かさない
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    d.moved = true;
    updateElement(d.id, { rect: { x: d.x + dx / scale, y: d.y + dy / scale } });
  };

  const onProxyPointerUp = () => {
    dragRef.current = null;
  };

  const onProxyDoubleClick = (id: string) => {
    const el = slide.elements.find((x) => x.id === id);
    if (el && el.tag !== 'img') startEditing(id);
  };

  const onBackgroundPointerDown = (e: PointerEvent) => {
    // 編集中のテキストの中をクリックした場合は、カーソル移動なので何もしない
    const path = e.nativeEvent.composedPath();
    if (editingId && path.some((n) => n instanceof HTMLElement && n.dataset.id === editingId)) return;
    selectElement(null);
  };

  // --- 3. テキスト編集 -------------------------------------------------------
  // 編集中は、Shadow DOM 内の本物の要素を contentEditable にして直接打ち込ませる。
  // フォーカスが外れたら、その時点の中身を store に書き戻す。
  useEffect(() => {
    if (!editingId) return;
    const node = rootRef.current?.querySelector<HTMLElement>(`[data-id="${editingId}"]`);
    if (!node) return;

    node.contentEditable = 'true';
    node.focus();
    // カーソルを末尾へ
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    const finish = () => {
      const { deck, current, updateElement, stopEditing } = useDeckStore.getState();
      const el = deck.slides[current].elements.find((x) => x.id === editingId);
      const html = node.innerHTML.trim();
      if (el && el.html !== html) updateElement(editingId, { html });
      stopEditing();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // キーイベントは Shadow DOM を越えて window まで届く。
        // 止めないと App の「Esc で選択解除」まで動くので、ここで止める（PowerPoint と同じく選択は残す）
        e.stopPropagation();
        node.blur();
      }
    };
    node.addEventListener('blur', finish);
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('blur', finish);
      node.removeEventListener('keydown', onKeyDown);
    };
  }, [editingId]);

  // スライドが無ければ何も描かない。
  // フックは毎回同じ順番で呼ばれる必要があるので、この return はすべてのフックより後に置く
  if (!slide) return null;

  const selectedEl = slide.elements.find((x) => x.id === selectedId);
  const selectedBox = boxes.find((b) => b.id === selectedId);

  return (
    <div
      className="editor-canvas"
      style={{ width, height: deck.height * scale }}
      onPointerDown={onBackgroundPointerDown}
    >
      <SlideView deck={deck} slide={slide} width={width} onRender={measure} />

      <div className={editingId ? 'overlay editing' : 'overlay'}>
        {boxes.map((b) => (
          <div
            key={b.id}
            className="proxy"
            style={{ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale }}
            onPointerDown={(e) => onProxyPointerDown(e, b)}
            onPointerMove={onProxyPointerMove}
            onPointerUp={onProxyPointerUp}
            onPointerCancel={onProxyPointerUp}
            onDoubleClick={() => onProxyDoubleClick(b.id)}
          />
        ))}

        {selectedEl && selectedBox && (
          <SelectionFrame
            box={selectedBox}
            scale={scale}
            showHandles={!editingId}
            keepRatio={selectedEl.tag === 'img'}
            onResize={(rect) => updateElement(selectedEl.id, { rect })}
          />
        )}
      </div>
    </div>
  );
}
