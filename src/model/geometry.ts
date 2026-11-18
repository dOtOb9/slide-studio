import type { Rect } from './types';

export const HANDLES = [
  { name: 'nw', hx: -1, hy: -1 },
  { name: 'n', hx: 0, hy: -1 },
  { name: 'ne', hx: 1, hy: -1 },
  { name: 'w', hx: -1, hy: 0 },
  { name: 'e', hx: 1, hy: 0 },
  { name: 'sw', hx: -1, hy: 1 },
  { name: 's', hx: 0, hy: 1 },
  { name: 'se', hx: 1, hy: 1 },
] as const;

export type Handle = Pick<(typeof HANDLES)[number], 'hx' | 'hy'>;

const MIN_SIZE_SLIDE_PX = 10;

const LEFT_OR_TOP_EDGE_MOVES = -1;
const AXIS_UNCHANGED = 0;

function scaleFollowingLargerChange(box: Rect, w: number, h: number): number {
  const sx = w / box.w;
  const sy = h / box.h;
  return Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy;
}

function minScaleKeepingRatioAboveMinSize(box: Rect): number {
  return Math.max(MIN_SIZE_SLIDE_PX / box.w, MIN_SIZE_SLIDE_PX / box.h);
}

export function resizeRect(box: Rect, handle: Handle, dx: number, dy: number, keepRatio: boolean): Partial<Rect> {
  const { hx, hy } = handle;
  let w = box.w + hx * dx;
  let h = box.h + hy * dy;

  const isCornerHandle = hx !== AXIS_UNCHANGED && hy !== AXIS_UNCHANGED;
  const ratioIsDefined = box.w > 0 && box.h > 0;
  if (keepRatio && isCornerHandle && ratioIsDefined) {
    const s = Math.max(scaleFollowingLargerChange(box, w, h), minScaleKeepingRatioAboveMinSize(box));
    w = box.w * s;
    h = box.h * s;
  }
  w = Math.max(MIN_SIZE_SLIDE_PX, w);
  h = Math.max(MIN_SIZE_SLIDE_PX, h);

  const out: Partial<Rect> = {};
  if (hx !== AXIS_UNCHANGED) {
    out.w = w;
    const xKeepingRightEdge = box.x + box.w - w;
    out.x = hx === LEFT_OR_TOP_EDGE_MOVES ? xKeepingRightEdge : box.x;
  }
  if (hy !== AXIS_UNCHANGED) {
    out.h = h;
    const yKeepingBottomEdge = box.y + box.h - h;
    out.y = hy === LEFT_OR_TOP_EDGE_MOVES ? yKeepingBottomEdge : box.y;
  }
  return out;
}
