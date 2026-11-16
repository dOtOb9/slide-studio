// 描画された要素の位置を測り、BoxesMeasured として送る（Elm でいう Subscription）。
//
// 幅や高さが指定されていない要素（文字数で幅が決まる等）もあるので、データからではなく DOM から測る。
// offsetLeft などは transform の影響を受けないので、スライド座標の値がそのまま取れる。

import { useCallback, useEffect, useRef } from 'react';
import type { Box } from '../app/model';
import { getModel, useDispatch } from '../app/store';

/** 測り直した結果が前回と同じかどうか（同じなら Msg を送らず、余計な再描画を避ける） */
function sameBoxes(a: Box[], b: Box[]): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => p.id === b[i].id && p.x === b[i].x && p.y === b[i].y && p.w === b[i].w && p.h === b[i].h)
  );
}

/**
 * 戻り値:
 *   rootRef  … 描画先の ShadowRoot（テキスト編集で要素を探すのに使う）
 *   onRender … SlideView に渡す。描画のたびに呼ばれ、位置を測る
 */
export function useBoxMeasurement() {
  const dispatch = useDispatch();
  const rootRef = useRef<ShadowRoot | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const onRender = useCallback(
    (root: ShadowRoot) => {
      rootRef.current = root;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>('section > [data-id]'));
      const read = () => {
        const boxes = nodes.map((n) => ({
          id: n.dataset.id!,
          x: n.offsetLeft,
          y: n.offsetTop,
          w: n.offsetWidth,
          h: n.offsetHeight,
        }));
        if (!sameBoxes(getModel().boxes, boxes)) dispatch({ type: 'BoxesMeasured', boxes });
      };
      read();
      // 描画の後で大きさが変わることがある（画像の読み込み完了、Web フォントの適用など）。
      // ResizeObserver で各要素を見張り、大きさが変わったら測り直す
      observerRef.current?.disconnect();
      observerRef.current = new ResizeObserver(read);
      nodes.forEach((n) => observerRef.current!.observe(n));
    },
    [dispatch],
  );

  // 画面から消えるときは見張りをやめる
  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { rootRef, onRender };
}
