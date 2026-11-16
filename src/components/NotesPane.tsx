// キャンバスの下の、発表者ノートの入力欄（view）。
//
// 入力中の文字はテキストエリアが持ち、フォーカスが外れたときに NotesCommitted を送る
// （1文字ごとに送ると、元に戻すの履歴が1文字ずつになってしまうため。テキスト編集と同じ考え方）。

import { useDispatch, useModel } from '../app/store';

export function NotesPane() {
  const current = useModel((m) => m.current);
  const notes = useModel((m) => m.deck.slides[m.current]?.notes);
  const dispatch = useDispatch();

  if (notes === undefined) return null; // スライドが 0 枚

  return (
    <div className="notes">
      <textarea
        // key が変わると作り直される。スライドを切り替えたときや、元に戻すでノートが変わったときに、
        // 表示を Model の値に合わせ直すため
        key={`${current}:${notes}`}
        defaultValue={notes}
        placeholder="クリックしてノートを入力"
        onBlur={(e) => dispatch({ type: 'NotesCommitted', index: current, notes: e.target.value })}
      />
    </div>
  );
}
