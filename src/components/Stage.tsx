import { slideAreaMarker } from '../app/slideArea';
import { useDispatch, useModel } from '../app/store';
import { useElementSize } from '../hooks/useElementSize';
import { EditorCanvas } from './EditorCanvas';

const MARGIN_AROUND_CANVAS_PX = 48;

export function Stage() {
  const width = useModel((m) => m.deck.width);
  const height = useModel((m) => m.deck.height);
  const hasSlide = useModel((m) => m.deck.slides.length > 0);
  const dispatch = useDispatch();

  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const fitWidth = Math.max(0, Math.min(stage.width - MARGIN_AROUND_CANVAS_PX, ((stage.height - MARGIN_AROUND_CANVAS_PX) * width) / height));

  return (
    <main
      {...slideAreaMarker}
      className="stage"
      ref={stageRef}
      onPointerDown={(e) => {
        const clickedOutsideSlide = e.target === e.currentTarget;
        if (clickedOutsideSlide) dispatch({ type: 'ElementSelected', id: null });
      }}
    >
      {hasSlide && fitWidth > 0 && (
        <div className="canvas">
          <EditorCanvas width={fitWidth} />
        </div>
      )}
    </main>
  );
}
