// 左側のスライド一覧（view）。

import { useDispatch, useModel } from '../app/store';
import { SlideView } from './SlideView';

export function ThumbnailList() {
  const deck = useModel((m) => m.deck);
  const current = useModel((m) => m.current);
  const dispatch = useDispatch();

  return (
    <aside className="thumbs">
      {deck.slides.map((s, i) => (
        <button
          key={s.id}
          className={i === current ? 'thumb active' : 'thumb'}
          onClick={() => dispatch({ type: 'SlideSelected', index: i })}
        >
          <span className="num">{i + 1}</span>
          <SlideView deck={deck} slide={s} width={180} />
        </button>
      ))}
    </aside>
  );
}
