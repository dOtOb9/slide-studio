const SLIDE_AREA_ATTRIBUTE = 'data-slide-area';

export const slideAreaMarker: Record<string, string> = { [SLIDE_AREA_ATTRIBUTE]: '' };

export function findSlideArea(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SLIDE_AREA_ATTRIBUTE}]`);
}
