import { describe, expect, it } from 'vitest';
import sample from '../samples/sample-deck.html?raw';
import { parseDeck } from './parse';
import { resolveRect, renderSlideHtml } from './render';
import { serializeDeck } from './serialize';

describe('parseDeck', () => {
  const deck = parseDeck(sample);

  it('サイズ・レイアウト・スライドを読み取る', () => {
    expect([deck.width, deck.height]).toEqual([1920, 1080]);
    expect(deck.layouts.map((l) => l.name)).toEqual(['cover', 'title-body', 'blank']);
    expect(deck.slides).toHaveLength(4);
    expect(deck.css).toContain('[data-ph="title"]');
  });

  it('プレースホルダーの位置と、位置以外のスタイルを分ける', () => {
    const title = deck.layouts[1].placeholders[0];
    expect(title.rect).toEqual({ x: 120, y: 60, w: 1680, h: 140 });
    expect(title.style).toContain('border-bottom');
  });

  it('プレースホルダーはレイアウトの位置を継承し、上書き分だけ差し替える', () => {
    const slide = deck.slides[2];
    const body = slide.elements[1];
    expect(body.rect).toEqual({ w: 1000 });
    expect(resolveRect(deck, slide, body)).toEqual({ x: 120, y: 260, w: 1000, h: 740 });
  });

  it('自由配置の要素は自分の位置を持つ', () => {
    const img = deck.slides[2].elements[3];
    expect(img.tag).toBe('img');
    expect(img.ph).toBeUndefined();
    expect(img.rect).toEqual({ x: 1500, y: 640, w: 320, h: 240 });
    expect(img.attrs.src).toMatch(/^data:image\/svg/);
  });
});

describe('serializeDeck', () => {
  it('読み込み→書き出し→読み込み で内容が変わらない', () => {
    const once = serializeDeck(parseDeck(sample));
    const twice = serializeDeck(parseDeck(once));
    expect(twice).toBe(once);
  });
});

describe('renderSlideHtml', () => {
  it('プレースホルダーを絶対座標に解決して出力する', () => {
    const deck = parseDeck(sample);
    const html = renderSlideHtml(deck, deck.slides[2]);
    expect(html).toContain('left:120px; top:260px; width:1000px; height:740px');
  });
});
