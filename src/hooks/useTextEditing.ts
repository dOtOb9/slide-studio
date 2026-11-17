import { useEffect, type RefObject } from 'react';
import { useDispatch } from '../app/store';

function placeCaretAtEnd(node: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

function keepEscapeFromCrossingShadowDomToDeselect(e: KeyboardEvent) {
  e.stopPropagation();
}

export function useTextEditing(rootRef: RefObject<ShadowRoot | null>, editingId: string | null) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!editingId) return;
    const node = rootRef.current?.querySelector<HTMLElement>(`[data-id="${editingId}"]`);
    if (!node) return;

    node.contentEditable = 'true';
    node.focus();
    placeCaretAtEnd(node);

    const onBlur = () => dispatch({ type: 'TextCommitted', id: editingId, html: node.innerHTML.trim() });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        keepEscapeFromCrossingShadowDomToDeselect(e);
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
