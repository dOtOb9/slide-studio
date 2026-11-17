// 大きさと置き場所の計算（純粋な関数）のテスト。update を通さないので、プラグインの登録は要らない。

import { describe, expect, it } from 'vitest';
import { fitSize, placeAt } from './layout';

const SLIDE = { width: 1920, height: 1080 };

describe('fitSize', () => {
  it('大きい画像は縦横比を保ってスライドの 80% に収める（横長は幅で、縦長は高さで決まる）', () => {
    expect(fitSize({ width: 4000, height: 1000 }, SLIDE)).toEqual({ w: 1536, h: 384 });
    expect(fitSize({ width: 1000, height: 3000 }, SLIDE)).toEqual({ w: 288, h: 864 });
  });

  it('スライドと同じ比率なら、ちょうど 80%', () => {
    expect(fitSize({ width: 3840, height: 2160 }, SLIDE)).toEqual({ w: 1536, h: 864 });
  });

  it('小さい画像は拡大しない', () => {
    expect(fitSize({ width: 200, height: 100 }, SLIDE)).toEqual({ w: 200, h: 100 });
    expect(fitSize({ width: 1536, height: 864 }, SLIDE)).toEqual({ w: 1536, h: 864 });
  });

  it('とても細長い画像でも 1px より小さくしない', () => {
    expect(fitSize({ width: 100000, height: 1 }, SLIDE)).toEqual({ w: 1536, h: 1 });
  });
});

describe('placeAt', () => {
  it('1枚目はスライドの中央', () => {
    expect(placeAt({ w: 400, h: 300 }, SLIDE, 0)).toEqual({ x: 760, y: 390, w: 400, h: 300 });
  });

  it('2枚目からは右下へ 40px ずつずらす', () => {
    expect(placeAt({ w: 400, h: 300 }, SLIDE, 1)).toEqual({ x: 800, y: 430, w: 400, h: 300 });
    expect(placeAt({ w: 400, h: 300 }, SLIDE, 2)).toEqual({ x: 840, y: 470, w: 400, h: 300 });
  });

  it('ずらしてはみ出すときは、右端・下端に寄せる', () => {
    expect(placeAt({ w: 1536, h: 864 }, SLIDE, 10)).toEqual({ x: 384, y: 216, w: 1536, h: 864 });
  });
});
