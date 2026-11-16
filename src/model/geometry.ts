// 位置・サイズの計算（React に依存しない純粋な関数）。

import type { Rect } from './types';

/**
 * リサイズ用の 8 つのハンドル。「どちらの辺が動くか」を hx, hy で表す:
 *   hx = -1 … 左辺が動く / 0 … 横方向は変えない / 1 … 右辺が動く（hy は上下で同様）
 */
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

const MIN_SIZE = 10; // これ以上は縮めない（スライド px）

/**
 * ハンドルを dx, dy（スライド px）動かしたときの新しい位置・サイズ。変わった項目だけを返す。
 * 例: 左上のハンドルを右下へ引くと、幅は縮み、左端は右へ動く（右下の角は固定）。
 */
export function resizeRect(box: Rect, handle: Handle, dx: number, dy: number, keepRatio: boolean): Partial<Rect> {
  const { hx, hy } = handle;
  let w = box.w + hx * dx;
  let h = box.h + hy * dy;

  // 角のハンドルで縦横比を保つ: 変化の大きい方に合わせる
  if (keepRatio && hx !== 0 && hy !== 0) {
    if (w / box.w > h / box.h) h = (w * box.h) / box.w;
    else w = (h * box.w) / box.h;
  }
  w = Math.max(MIN_SIZE, w);
  h = Math.max(MIN_SIZE, h);

  const out: Partial<Rect> = {};
  if (hx !== 0) {
    out.w = w;
    out.x = hx < 0 ? box.x + box.w - w : box.x; // 左辺を動かすときは右端を固定する
  }
  if (hy !== 0) {
    out.h = h;
    out.y = hy < 0 ? box.y + box.h - h : box.y; // 上辺を動かすときは下端を固定する
  }
  return out;
}
