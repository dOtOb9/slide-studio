import {
  currentSlide,
  edit,
  insertElement,
  isBusy,
  isImagePath,
  withNewIds,
  type Deck,
  type Model,
  type SlideElement,
} from '../../plugin-api';
import { fitSize, placeAt } from './layout';

export type ImageToInsert = { path: string; width: number; height: number };

export type ImagesMsg = { type: 'images/Inserted'; images: ImageToInsert[] };

export function canInsertImages(model: Model): boolean {
  return currentSlide(model) !== undefined && !isBusy(model);
}

export function acceptInsertions(model: Model, value: unknown): { accepted: ImageToInsert[]; rejected: unknown[] } {
  const accepted: ImageToInsert[] = [];
  const rejected: unknown[] = [];
  if (!Array.isArray(value)) return { accepted, rejected: [value] };
  const isSize = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;
  for (const item of value as unknown[]) {
    const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const ok =
      isImagePath(obj.path) &&
      Object.prototype.hasOwnProperty.call(model.images, obj.path) &&
      isSize(obj.width) &&
      isSize(obj.height);
    if (ok) accepted.push({ path: obj.path as string, width: obj.width as number, height: obj.height as number });
    else rejected.push(item);
  }
  return { accepted, rejected };
}

export function updateImages(model: Model, msg: ImagesMsg): Model {
  switch (msg.type) {
    case 'images/Inserted': {
      const slide = currentSlide(model);
      if (!slide || !canInsertImages(model)) return model;
      const { accepted, rejected } = acceptInsertions(model, msg.images);
      if (rejected.length > 0) console.warn('images/Inserted の中の、置けない項目を捨てました', rejected);
      if (accepted.length === 0) return model;

      const deckSize = { width: model.deck.width, height: model.deck.height };
      const { result: elements, nextId } = withNewIds(model, (newId) =>
        accepted.map(
          (image, index): SlideElement => ({
            id: newId(),
            tag: 'img',
            attrs: { src: image.path },
            style: '',
            html: '',
            rect: placeAt(fitSize(image, deckSize), deckSize, index),
          }),
        ),
      );
      let deck: Deck = model.deck;
      for (const element of elements) deck = insertElement(deck, slide.id, element);
      const editedOnceForAllImages = edit(model, deck);
      const topmostInserted = elements[elements.length - 1];
      return { ...editedOnceForAllImages, nextId, selectedId: topmostInserted.id };
    }
  }
}
