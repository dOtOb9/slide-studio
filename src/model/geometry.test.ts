import { describe, expect, it } from 'vitest';
import { resizeRect, type Handle } from './geometry';

const box = { x: 100, y: 100, w: 200, h: 100 };
const handle = (hx: -1 | 0 | 1, hy: -1 | 0 | 1) => ({ hx, hy }) as Handle;

describe('resizeRect', () => {
  it('右下: 幅と高さだけが増える', () => {
    expect(resizeRect(box, handle(1, 1), 20, 10, false)).toEqual({ x: 100, w: 220, y: 100, h: 110 });
  });

  it('左上: 右下の角を固定したまま縮む', () => {
    expect(resizeRect(box, handle(-1, -1), 20, 10, false)).toEqual({ x: 120, w: 180, y: 110, h: 90 });
  });

  it('辺のハンドル: 片方向だけを返す', () => {
    expect(resizeRect(box, handle(0, 1), 50, 30, false)).toEqual({ y: 100, h: 130 });
  });

  it('縦横比を保つ: 変化の大きい方に合わせる', () => {
    expect(resizeRect(box, handle(1, 1), 200, 0, true)).toEqual({ x: 100, w: 400, y: 100, h: 200 });
  });

  it('縦横比を保つ: 縮小方向でも変化の大きい方に合わせる', () => {
    // 右下を左へ 100 引く → 幅が半分 → 高さも半分
    expect(resizeRect(box, handle(1, 1), -100, 0, true)).toEqual({ x: 100, w: 100, y: 100, h: 50 });
  });

  it('縦横比を保つ: 左上ハンドルでは右下の角が固定される', () => {
    expect(resizeRect(box, handle(-1, -1), 100, 0, true)).toEqual({ x: 200, w: 100, y: 150, h: 50 });
  });

  it('縦横比を保つ: 最小サイズでも比率が崩れない', () => {
    // 200x100 を極端に縮める → 高さが 10 で止まり、幅は比率どおり 20
    expect(resizeRect(box, handle(1, 1), -1000, 0, true)).toEqual({ x: 100, w: 20, y: 100, h: 10 });
  });

  it('高さ 0 の要素でも NaN にならない（比率固定は使わない）', () => {
    const flat = { x: 0, y: 0, w: 200, h: 0 };
    const r = resizeRect(flat, handle(1, 1), 30, 0, true);
    expect(r).toEqual({ x: 0, w: 230, y: 0, h: 10 });
  });

  it('最小サイズより小さくならない', () => {
    expect(resizeRect(box, handle(1, 0), -500, 0, false)).toEqual({ x: 100, w: 10 });
  });
});

