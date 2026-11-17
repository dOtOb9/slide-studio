import type { Rect } from '../../plugin-api';

export const MAX_FRACTION_OF_SLIDE = 0.8;

export const CASCADE_STEP_SO_CORNER_BELOW_STAYS_VISIBLE = 40;

export function fitSize(
  natural: { width: number; height: number },
  slide: { width: number; height: number },
): { w: number; h: number } {
  const neverEnlargeSmallImages = 1;
  const scale = Math.min(neverEnlargeSmallImages, (slide.width * MAX_FRACTION_OF_SLIDE) / natural.width, (slide.height * MAX_FRACTION_OF_SLIDE) / natural.height);
  return {
    w: Math.max(1, Math.round(natural.width * scale)),
    h: Math.max(1, Math.round(natural.height * scale)),
  };
}

export function placeAt(size: { w: number; h: number }, slide: { width: number; height: number }, index: number): Rect {
  const offset = index * CASCADE_STEP_SO_CORNER_BELOW_STAYS_VISIBLE;
  const x = Math.round((slide.width - size.w) / 2) + offset;
  const y = Math.round((slide.height - size.h) / 2) + offset;
  const clampToSlideRightAndBottom = (v: number, max: number) => Math.max(0, Math.min(v, max));
  return {
    x: clampToSlideRightAndBottom(x, slide.width - size.w),
    y: clampToSlideRightAndBottom(y, slide.height - size.h),
    w: size.w,
    h: size.h,
  };
}
