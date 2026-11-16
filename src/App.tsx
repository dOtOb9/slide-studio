import { useEffect, type ChangeEvent } from 'react';
import { SlideView } from './components/SlideView';
import { useElementSize } from './hooks/useElementSize';
import { useDeckStore } from './store';

export default function App() {
  const deck = useDeckStore((s) => s.deck);
  const fileName = useDeckStore((s) => s.fileName);
  const current = useDeckStore((s) => s.current);
  const load = useDeckStore((s) => s.load);
  const select = useDeckStore((s) => s.select);

  // ↑↓ キーでスライド移動
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') select(current + 1);
      if (e.key === 'ArrowUp' || e.key === 'PageUp') select(current - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, select]);

  const openFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) load(await file.text(), file.name);
    e.target.value = ''; // 同じファイルをもう一度選べるように
  };

  // キャンバス領域に収まる最大の表示幅を計算（余白 48px）
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const fitWidth = Math.max(0, Math.min(stage.width - 48, ((stage.height - 48) * deck.width) / deck.height));

  const slide = deck.slides[current];

  return (
    <div className="app">
      <header className="toolbar">
        <label className="button">
          開く…
          <input type="file" accept=".html,.htm" onChange={openFile} hidden />
        </label>
        <span className="filename">{fileName}</span>
      </header>

      <aside className="thumbs">
        {deck.slides.map((s, i) => (
          <button
            key={s.id}
            className={i === current ? 'thumb active' : 'thumb'}
            onClick={() => select(i)}
          >
            <span className="num">{i + 1}</span>
            <SlideView deck={deck} slide={s} width={180} />
          </button>
        ))}
      </aside>

      <main className="stage" ref={stageRef}>
        {slide && fitWidth > 0 && (
          <div className="canvas">
            <SlideView deck={deck} slide={slide} width={fitWidth} />
          </div>
        )}
      </main>
    </div>
  );
}
