// 挿入する画像の大きさと置き場所の計算（純粋な関数だけ。DOM にも Model にも依存しない）。

import type { Rect } from '../../plugin-api';

/** スライドのこの割合に収まるように縮める */
export const FIT_RATIO = 0.8;

/** 複数の画像を一度に入れたとき、1枚ごとにずらす量（スライド px）。重なっても下の画像の角が見えるように */
export const CASCADE_STEP = 40;

/**
 * 画像の元の大きさ（px）を、縦横比を保ったままスライドの 80% に収まる大きさにする。
 * 小さい画像は拡大しない（元の大きさのまま）。結果は整数の px（最低 1px）
 */
export function fitSize(
  natural: { width: number; height: number },
  slide: { width: number; height: number },
): { w: number; h: number } {
  const scale = Math.min(1, (slide.width * FIT_RATIO) / natural.width, (slide.height * FIT_RATIO) / natural.height);
  return {
    w: Math.max(1, Math.round(natural.width * scale)),
    h: Math.max(1, Math.round(natural.height * scale)),
  };
}

/**
 * index 枚目（0 始まり）の画像の位置。スライドの中央に置き、2枚目からは右下へ CASCADE_STEP ずつずらす。
 * ずらしてスライドからはみ出すときは、スライドの右端・下端に寄せる（はみ出さない）
 */
export function placeAt(size: { w: number; h: number }, slide: { width: number; height: number }, index: number): Rect {
  const offset = index * CASCADE_STEP;
  const x = Math.round((slide.width - size.w) / 2) + offset;
  const y = Math.round((slide.height - size.h) / 2) + offset;
  return {
    x: Math.max(0, Math.min(x, slide.width - size.w)),
    y: Math.max(0, Math.min(y, slide.height - size.h)),
    w: size.w,
    h: size.h,
  };
}
