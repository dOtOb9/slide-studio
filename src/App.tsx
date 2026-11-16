import { useEffect, type ChangeEvent } from 'react';
import { EditorCanvas } from './components/EditorCanvas';
import { SlideView } from './components/SlideView';
import { useElementSize } from './hooks/useElementSize';
import { useDeckStore } from './store';

/** キー操作。最新の状態は getState() で読むので、登録は1回だけで済む */
function onKeyDown(e: KeyboardEvent) {
  const s = useDeckStore.getState();
  if (s.editingId) return; // テキスト編集中のキーは文字入力に任せる

  if (s.selectedId) {
    const slide = s.deck.slides[s.current];
    const el = slide.elements.find((x) => x.id === s.selectedId);
    if (!el) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      s.deleteElement(el.id);
    } else if (e.key === 'Escape') {
      s.selectElement(null);
    } else if (e.key === 'Enter' && el.tag !== 'img') {
      e.preventDefault();
      s.startEditing(el.id);
    } else if (e.key.startsWith('Arrow')) {
      // 矢印キーで 1px（Shift で 10px）動かす。起点はドラッグと同じく「実際に表示された位置」
      const box = s.boxes.find((b) => b.id === el.id);
      if (!box) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const { x, y } = box;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      s.updateElement(el.id, { rect: { x: x + dx, y: y + dy } });
    }
    return;
  }

  // 何も選択していなければ ↑↓ でスライド移動
  if (e.key === 'ArrowDown' || e.key === 'PageDown') s.select(s.current + 1);
  if (e.key === 'ArrowUp' || e.key === 'PageUp') s.select(s.current - 1);
}

export default function App() {
  const deck = useDeckStore((s) => s.deck);
  const fileName = useDeckStore((s) => s.fileName);
  const current = useDeckStore((s) => s.current);
  const load = useDeckStore((s) => s.load);
  const select = useDeckStore((s) => s.select);
  const selectElement = useDeckStore((s) => s.selectElement);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) load(await file.text(), file.name);
    e.target.value = ''; // 同じファイルをもう一度選べるように
  };

  // キャンバス領域に収まる最大の表示幅を計算（余白 48px）
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const fitWidth = Math.max(0, Math.min(stage.width - 48, ((stage.height - 48) * deck.width) / deck.height));

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

      {/* スライドの外側（灰色の部分）をクリックしたら選択解除 */}
      <main
        className="stage"
        ref={stageRef}
        onPointerDown={(e) => e.target === e.currentTarget && selectElement(null)}
      >
        {/* スライドが 0 枚のファイルもありうる */}
        {deck.slides[current] && fitWidth > 0 && (
          <div className="canvas">
            <EditorCanvas width={fitWidth} />
          </div>
        )}
      </main>
    </div>
  );
}
