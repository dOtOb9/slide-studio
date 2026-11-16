// キーボードの監視（Elm でいう Subscription）。
// 押されたキーを KeyPressed という Msg にして送るだけ。何をするかは update が決める。
// ただしファイルの読み書き（Ctrl+S / Ctrl+O）は外の世界とのやり取りなので、io/ の手順を直接呼ぶ。

import { useEffect } from 'react';
import { getModel, useDispatch } from '../app/store';
import { openDeck, saveDeck } from '../io/commands';

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

      // 矢印と Enter は、ブラウザ標準の動作（スクロールなど）を常に止める
      if (e.key.startsWith('Arrow') || e.key === 'Enter') e.preventDefault();

      const before = getModel();
      dispatch({ type: 'KeyPressed', key: e.key, shift: e.shiftKey, mod });
      // Ctrl 系のキーは、アプリが実際に何かをした（Model が変わった）ときだけブラウザ標準の動作を止める。
      // こうしておけば、機能が onKey で新しいショートカットを足しても、ここを書き換えなくてよい。
      // 下の一覧は、Model が変わらない場面でもブラウザの動作（ブックマーク・新規ウィンドウなど）を出したくないキー
      if (mod && (getModel() !== before || /^[zymd]$/i.test(e.key))) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
}
