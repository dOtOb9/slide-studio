import { useCallback, useEffect, useRef } from 'react';
import type { Box } from '../app/model';
import { getModel, useDispatch } from '../app/store';

function sameBoxes(a: Box[], b: Box[]): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => p.id === b[i].id && p.x === b[i].x && p.y === b[i].y && p.w === b[i].w && p.h === b[i].h)
  );
}

function measureInSlidePxUnaffectedByTransform(n: HTMLElement) {
  return { x: n.offsetLeft, y: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight };
}

function measureSvgWithoutOffsetsByScreenRect(n: Element, section: HTMLElement) {
  const s = section.getBoundingClientRect();
  const r = n.getBoundingClientRect();
  const displayScale = s.width / section.offsetWidth;
  return {
    x: Math.round((r.left - s.left) / displayScale),
    y: Math.round((r.top - s.top) / displayScale),
    w: Math.round(r.width / displayScale),
    h: Math.round(r.height / displayScale),
  };
}

function measureFromDomSinceSizeMayBeUnwritten(n: Element, section: HTMLElement) {
  if (n instanceof HTMLElement) return measureInSlidePxUnaffectedByTransform(n);
  return measureSvgWithoutOffsetsByScreenRect(n, section);
}

export function useBoxMeasurement() {
  const dispatch = useDispatch();
  const rootRef = useRef<ShadowRoot | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const onRender = useCallback(
    (root: ShadowRoot) => {
      rootRef.current = root;
      const section = root.querySelector<HTMLElement>('section');
      const nodes = Array.from(root.querySelectorAll('section > [data-id]'));
      const read = () => {
        const boxes = nodes.map((n) => ({ id: n.getAttribute('data-id')!, ...measureFromDomSinceSizeMayBeUnwritten(n, section!) }));
        const changedSinceLastMeasure = !sameBoxes(getModel().boxes, boxes);
        if (changedSinceLastMeasure) dispatch({ type: 'BoxesMeasured', boxes });
      };
      read();
      observerRef.current?.disconnect();
      const remeasureAfterImagesOrWebFontsLoad = new ResizeObserver(read);
      observerRef.current = remeasureAfterImagesOrWebFontsLoad;
      nodes.forEach((n) => observerRef.current!.observe(n));
    },
    [dispatch],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { rootRef, onRender };
}
