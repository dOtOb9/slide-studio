import { currentSlide, edit, insertElement, isBusy, withNewIds, type Model, type SlideElement } from '../../plugin-api';

export type ShapeKind = 'text' | 'rect' | 'ellipse' | 'arrow';

export type ShapesMsg = { type: 'shapes/Inserted'; shape: ShapeKind };

const TEMPLATES: Record<ShapeKind, Omit<SlideElement, 'id' | 'rect'> & { w: number; h: number }> = {
  text: { tag: 'div', attrs: {}, style: 'font-size:40px', html: 'テキスト', w: 600, h: 80 },
  rect: { tag: 'div', attrs: { 'data-shape': 'rect' }, style: 'background:#4c6ef5', html: '', w: 400, h: 300 },
  ellipse: {
    tag: 'div',
    attrs: { 'data-shape': 'ellipse' },
    style: 'background:#4c6ef5; border-radius:50%',
    html: '',
    w: 300,
    h: 300,
  },
  arrow: {
    tag: 'svg',
    attrs: { 'data-shape': 'arrow', viewBox: '0 0 100 20', preserveAspectRatio: 'none' },
    style: '',
    html: '<path d="M0 10 H88 M80 2 L96 10 L80 18" fill="none" stroke="#1f2933" stroke-width="4" vector-effect="non-scaling-stroke"/>',
    w: 400,
    h: 80,
  },
};

export function updateShapes(model: Model, msg: ShapesMsg): Model {
  switch (msg.type) {
    case 'shapes/Inserted': {
      const slide = currentSlide(model);
      if (!slide || isBusy(model)) return model;
      const { w, h, ...rest } = TEMPLATES[msg.shape];
      const rect = { x: Math.round((model.deck.width - w) / 2), y: Math.round((model.deck.height - h) / 2), w, h };
      const { result: element, nextId } = withNewIds(model, (newId) => ({ ...rest, id: newId(), rect }));
      const next = edit(model, insertElement(model.deck, slide.id, element));
      return { ...next, nextId, selectedId: element.id };
    }
  }
}
