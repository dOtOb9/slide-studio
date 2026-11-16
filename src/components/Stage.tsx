// 中央の作業領域（view）。キャンバスを領域いっぱいに収まる大きさで表示する。

import { useDispatch, useModel } from '../app/store';
import { useElementSize } from '../hooks/useElementSize';
import { EditorCanvas } from './EditorCanvas';

const MARGIN = 48; // キャンバスの周りの余白（px）

export function Stage() {
  const width = useModel((m) => m.deck.width);
  const height = useModel((m) => m.deck.height);
  const hasSlide = useModel((m) => m.deck.slides.length > 0); // スライドが 0 枚のファイルもありうる
  const dispatch = useDispatch();

  // 画面の大きさは見た目だけの情報なので、Model には入れずここで持つ
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const fitWidth = Math.max(0, Math.min(stage.width - MARGIN, ((stage.height - MARGIN) * width) / height));

  return (
    <main
      className="stage"
      ref={stageRef}
      // スライドの外側（灰色の部分）をクリックしたら選択解除
      onPointerDown={(e) => e.target === e.currentTarget && dispatch({ type: 'ElementSelected', id: null })}
    >
      {hasSlide && fitWidth > 0 && (
        <div className="canvas">
          <EditorCanvas width={fitWidth} />
        </div>
      )}
    </main>
  );
}
