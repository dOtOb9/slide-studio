// 左側のスライド一覧（view）。クリックで表示、ドラッグ＆ドロップで並べ替え。

import { useState, type DragEvent } from 'react';
import { useDispatch, useModel } from '../app/store';
import { SlideView } from './SlideView';

export function ThumbnailList() {
  const deck = useModel((m) => m.deck);
  const current = useModel((m) => m.current);
  const dispatch = useDispatch();

  // ドラッグ中の表示（どれをつかんでいて、どこに挿入線を出すか）。
  // ドロップするまで Model は変えない、見た目だけの一時的な状態なので、ここで持つ
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null); // この番号のスライドの「前」に入れる

  const onDragOver = (e: DragEvent<HTMLElement>, i: number) => {
    if (dragFrom === null) return;
    e.preventDefault(); // これを呼ぶと「ここにドロップできる」ことになる
    const r = e.currentTarget.getBoundingClientRect();
    setInsertAt(e.clientY < r.top + r.height / 2 ? i : i + 1); // 上半分なら前、下半分なら後ろ
  };

  const onDrop = () => {
    if (dragFrom !== null && insertAt !== null) {
      // 取り出した後の並びでの位置に直す（自分より後ろに入れるときは1つずれる）
      const to = insertAt > dragFrom ? insertAt - 1 : insertAt;
      dispatch({ type: 'SlideMoved', from: dragFrom, to });
    }
    endDrag();
  };

  const endDrag = () => {
    setDragFrom(null);
    setInsertAt(null);
  };

  return (
    <aside className="thumbs" onDragLeave={(e) => e.target === e.currentTarget && setInsertAt(null)}>
      {deck.slides.map((s, i) => {
        const classes = ['thumb'];
        if (i === current) classes.push('active');
        if (insertAt === i) classes.push('insert-before');
        if (insertAt === i + 1 && i === deck.slides.length - 1) classes.push('insert-after');
        return (
          <button
            key={s.id}
            className={classes.join(' ')}
            draggable
            onClick={() => dispatch({ type: 'SlideSelected', index: i })}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              setDragFrom(i);
            }}
            onDragOver={(e) => onDragOver(e, i)}
            onDrop={onDrop}
            onDragEnd={endDrag}
          >
            <span className="num">{i + 1}</span>
            <SlideView deck={deck} slide={s} width={180} />
          </button>
        );
      })}
    </aside>
  );
}
