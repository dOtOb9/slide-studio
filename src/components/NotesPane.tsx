import { useDispatch, useModel } from '../app/store';

export function NotesPane() {
  const current = useModel((m) => m.current);
  const notes = useModel((m) => m.deck.slides[m.current]?.notes);
  const dispatch = useDispatch();

  const deckHasNoSlides = notes === undefined;
  if (deckHasNoSlides) return null;
  const remountToResyncWithModelOnSlideSwitchOrUndo = `${current}:${notes}`;

  return (
    <div className="notes">
      <textarea
        key={remountToResyncWithModelOnSlideSwitchOrUndo}
        defaultValue={notes}
        placeholder="クリックしてノートを入力"
        onBlur={(e) => dispatch({ type: 'NotesCommitted', index: current, notes: e.target.value })}
      />
    </div>
  );
}
