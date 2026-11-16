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

  it('最小サイズより小さくならない', () => {
    expect(resizeRect(box, handle(1, 0), -500, 0, false)).toEqual({ x: 100, w: 10 });
  });
});

