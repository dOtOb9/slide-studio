// キーボードの監視（Elm でいう Subscription）。
// 押されたキーを KeyPressed という Msg にして送るだけ。何をするかは update が決める。

import { useEffect } from 'react';
import { getModel, useDispatch } from '../app/store';

export function useKeyboard() {
  const dispatch = useDispatch();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // テキスト編集中のキーは文字入力（とブラウザ自身の Ctrl+Z）に任せる
      if (getModel().editingId) return;
      // ボタンなどにフォーカスがあるときの Enter / Space は、そのボタンを押す操作なのでブラウザに任せる
      // （Ctrl+Z などは、元に戻すボタンを押した直後でも効くよう、ここでは止めない）
      const onControl = e.target instanceof Element && e.target.closest('button, input, label');
      if ((e.key === 'Enter' || e.key === ' ') && onControl) return;
      const mod = e.ctrlKey || e.metaKey;
      // ブラウザ標準の動作（矢印でのスクロールなど）を止めるキー
      if (e.key.startsWith('Arrow') || e.key === 'Enter' || (mod && /^[zy]$/i.test(e.key))) {
        e.preventDefault();
      }
      dispatch({ type: 'KeyPressed', key: e.key, shift: e.shiftKey, mod });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
}
