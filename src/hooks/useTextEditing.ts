// テキスト編集。TEA の例外として、編集中の文字は DOM（contentEditable）が持つ。
// 編集が終わったら（フォーカスが外れたら）、その時点の中身を TextCommitted として送る。

import { useEffect, type RefObject } from 'react';
import { useDispatch } from '../app/store';

export function useTextEditing(rootRef: RefObject<ShadowRoot | null>, editingId: string | null) {
  const dispatch = useDispatch();

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

    const onBlur = () => dispatch({ type: 'TextCommitted', id: editingId, html: node.innerHTML.trim() });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // キーイベントは Shadow DOM を越えて window まで届く。
        // 止めないと「Esc で選択解除」まで動くので、ここで止める（PowerPoint と同じく選択は残す）
        e.stopPropagation();
        node.blur();
      }
    };
    node.addEventListener('blur', onBlur);
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('blur', onBlur);
      node.removeEventListener('keydown', onKeyDown);
    };
  }, [rootRef, editingId, dispatch]);
}
