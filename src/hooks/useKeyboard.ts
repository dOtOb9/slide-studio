import { useEffect } from 'react';
import { getModel, useDispatch } from '../app/store';
import { openDeck, saveDeck } from '../io/commands';

const FILE_SHORTCUT_WORKS_EVEN_WHILE_EDITING_TEXT = /^[so]$/i;
const BROWSER_SHORTCUTS_SUPPRESSED_EVEN_IF_MODEL_UNCHANGED = /^[zymd]$/i;

function commitFocusedFieldBeforeFileAccess() {
  (document.activeElement as HTMLElement | null)?.blur();
}

export const TEXT_INPUT_TYPE_WHERE_SHORTCUTS_ARE_OFF = 'text';

function isTextEntryField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && target.type === TEXT_INPUT_TYPE_WHERE_SHORTCUTS_ARE_OFF)
  );
}

function pressesFocusedControlLikeAButton(e: KeyboardEvent): boolean {
  const onControl = e.target instanceof Element && e.target.closest('button, input, label, select');
  return (e.key === 'Enter' || e.key === ' ') && Boolean(onControl);
}

function stopsBrowserScrollAlways(key: string): boolean {
  return key.startsWith('Arrow') || key === 'Enter';
}

export function useKeyboard() {
  const dispatch = useDispatch();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && FILE_SHORTCUT_WORKS_EVEN_WHILE_EDITING_TEXT.test(e.key)) {
        e.preventDefault();
        commitFocusedFieldBeforeFileAccess();
        if (e.key.toLowerCase() === 's') void saveDeck(e.shiftKey);
        else void openDeck();
        return;
      }

      const leaveToContentEditableAndBrowserUndo = getModel().editingId !== null;
      if (leaveToContentEditableAndBrowserUndo) return;
      if (isTextEntryField(e.target)) return;
      if (pressesFocusedControlLikeAButton(e)) return;

      if (stopsBrowserScrollAlways(e.key)) e.preventDefault();

      const before = getModel();
      dispatch({ type: 'KeyPressed', key: e.key, shift: e.shiftKey, mod });
      const appHandledIt = getModel() !== before;
      if (mod && (appHandledIt || BROWSER_SHORTCUTS_SUPPRESSED_EVEN_IF_MODEL_UNCHANGED.test(e.key))) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
}
