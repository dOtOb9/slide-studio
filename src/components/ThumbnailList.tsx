import { useState, type DragEvent } from 'react';
import { useDispatch, useModel } from '../app/store';
import { SlideView } from './SlideView';

export function ThumbnailList() {
  const deck = useModel((m) => m.deck);
  const current = useModel((m) => m.current);
  const images = useModel((m) => m.images);
  const dispatch = useDispatch();

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [insertBeforeIndex, setInsertBeforeIndex] = useState<number | null>(null);

  const onDragOver = (e: DragEvent<HTMLElement>, i: number) => {
    if (dragFrom === null) return;
    const allowDropHere = () => e.preventDefault();
    allowDropHere();
    const r = e.currentTarget.getBoundingClientRect();
    const overUpperHalf = e.clientY < r.top + r.height / 2;
    setInsertBeforeIndex(overUpperHalf ? i : i + 1);
  };

  const onDrop = () => {
    if (dragFrom !== null && insertBeforeIndex !== null) {
      const toIndexAfterRemoval = insertBeforeIndex > dragFrom ? insertBeforeIndex - 1 : insertBeforeIndex;
      dispatch({ type: 'SlideMoved', from: dragFrom, to: toIndexAfterRemoval });
    }
    endDrag();
  };

  const endDrag = () => {
    setDragFrom(null);
    setInsertBeforeIndex(null);
  };

  return (
    <aside className="thumbs" onDragLeave={(e) => e.target === e.currentTarget && setInsertBeforeIndex(null)}>
      {deck.slides.map((s, i) => {
        const classes = ['thumb'];
        if (i === current) classes.push('active');
        if (insertBeforeIndex === i) classes.push('insert-before');
        if (insertBeforeIndex === i + 1 && i === deck.slides.length - 1) classes.push('insert-after');
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
            <SlideView deck={deck} slide={s} width={180} images={images} />
          </button>
        );
      })}
    </aside>
  );
}
