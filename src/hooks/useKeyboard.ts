// キーボードの監視（Elm でいう Subscription）。
// 押されたキーを KeyPressed という Msg にして送るだけ。何をするかは update が決める。
// ただしファイルの読み書き（Ctrl+S / Ctrl+O）は外の世界とのやり取りなので、io/ の手順を直接呼ぶ。

import { useEffect } from 'react';
import { getModel, useDispatch } from '../app/store';
import { openDeck, saveDeck } from '../io/commands';

/** ブラウザ標準の動作（矢印でのスクロール、Ctrl+D のブックマークなど）を止める Ctrl 系のキー */
const APP_MOD_KEYS = /^[zymdso]$/i;

export function useKeyboard() {
  const dispatch = useDispatch();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // 保存と開くは、テキスト編集中でも効かせる（編集中の内容は、保存の前にフォーカスを外して確定させる）
      if (mod && /^[so]$/i.test(e.key)) {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        if (e.key.toLowerCase() === 's') void saveDeck(e.shiftKey);
        else void openDeck();
        return;
      }

      // テキスト編集中のキーは文字入力（とブラウザ自身の Ctrl+Z）に任せる
      if (getModel().editingId) return;
      // ノート欄など、文字を入力する欄でのキーも同様
      if (e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLInputElement && e.target.type === 'text')) {
        return;
      }
      // ボタンなどにフォーカスがあるときの Enter / Space は、そのボタンを押す操作なのでブラウザに任せる
      // （Ctrl+Z などは、元に戻すボタンを押した直後でも効くよう、ここでは止めない）
      const onControl = e.target instanceof Element && e.target.closest('button, input, label, select');
      if ((e.key === 'Enter' || e.key === ' ') && onControl) return;
      if (e.key.startsWith('Arrow') || e.key === 'Enter' || (mod && APP_MOD_KEYS.test(e.key))) {
        e.preventDefault();
      }
      dispatch({ type: 'KeyPressed', key: e.key, shift: e.shiftKey, mod });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
}
