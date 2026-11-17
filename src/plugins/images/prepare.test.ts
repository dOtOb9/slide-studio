// 受け取ったファイルを挿入できる形にする処理（部品の側）のテスト。
// 自分のプラグインを先に import して登録する（insertImageFiles の結果を土台の update に流して確かめるため）。
import { images } from './plugin';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { initModel, type Model } from '../../app/model';
import type { Msg } from '../../app/msg';
import { update } from '../../app/update';
import { parseDeck } from '../../model/parse';
import sample from '../../samples/sample-deck.html?raw';
import { registerPlugin } from '../host';
import { insertImageFiles, prepareImages, rejectReason, type PrepareDeps } from './prepare';

registerPlugin(images, 'builtin');

afterEach(() => {
  vi.restoreAllMocks();
});

const png = (name: string, content = name) => new File([content], name, { type: 'image/png' });

/** jsdom は画像を読めないので、測る関数を差し替える（名前に bad が入っていたら測れない画像とみなす） */
const deps: PrepareDeps = {
  measure: async (blob) => ((blob as File).name.includes('bad') ? null : { width: 400, height: 300 }),
  pathOf: async (blob) => `images/${(blob as File).name.replace(/\W/g, '').padEnd(64, '0')}.png`,
};

describe('rejectReason（受け取ったファイルを確かめる）', () => {
  it('images/ に置ける形式の画像なら null', () => {
    expect(rejectReason(png('a.png'))).toBeNull();
    expect(rejectReason(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toBeNull();
  });

  it.each([
    ['File でない', 'a.png', /ファイルではありません/],
    ['Blob（名前の無いもの）', new Blob(['x'], { type: 'image/png' }), /ファイルではありません/],
    ['null', null, /ファイルではありません/],
    ['空', new File([], 'a.png', { type: 'image/png' }), /空/],
    ['画像でない', new File(['x'], 'a.txt', { type: 'text/plain' }), /画像ではありません/],
    ['対応していない画像の形式', new File(['x'], 'a.bmp', { type: 'image/bmp' }), /対応していない形式です（image\/bmp）/],
    ['形式が分からない', new File(['x'], 'a'), /形式が分かりません/],
  ])('%s → 理由', (_, value, reason) => {
    expect(rejectReason(value)).toMatch(reason);
  });

  it('大きすぎる（50MB 超）→ 理由', () => {
    const big = png('big.png');
    Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 + 1 });
    expect(rejectReason(big)).toMatch(/大きすぎます/);
  });
});

describe('prepareImages', () => {
  it('入れられるものと断るもの（理由つき）に分ける。1つが不正でもほかは入れ、並びは受け取った順', async () => {
    const throwing: PrepareDeps = {
      ...deps,
      pathOf: async (blob) => {
        if ((blob as File).name === 'boom.png') throw new Error('壊れた');
        return deps.pathOf(blob);
      },
    };
    const { ready, rejected } = await prepareImages(
      [png('a.png'), new File(['x'], 'b.txt', { type: 'text/plain' }), png('bad.png'), png('boom.png'), png('c.png')],
      throwing,
    );
    expect(ready.map((r) => r.image)).toEqual([
      { path: `images/apng${'0'.repeat(60)}.png`, width: 400, height: 300 },
      { path: `images/cpng${'0'.repeat(60)}.png`, width: 400, height: 300 },
    ]);
    expect(rejected).toEqual([
      { name: 'b.txt', reason: '画像ではありません（text/plain）' },
      { name: 'bad.png', reason: '画像として読めません（大きさを測れません）' },
      { name: 'boom.png', reason: '読めませんでした（壊れた）' },
    ]);
  });

  it('パスを作れない（対応しない型）なら断る', async () => {
    const { ready, rejected } = await prepareImages([png('a.png')], { ...deps, pathOf: async () => null });
    expect(ready).toEqual([]);
    expect(rejected).toEqual([{ name: 'a.png', reason: '対応していない形式です' }]);
  });
});

describe('insertImageFiles（ボタン・貼り付け・ドロップの共通の手順）', () => {
  /** 送られた Msg を記録しながら、土台の update に流す */
  function runner() {
    let model: Model = update(initModel(parseDeck(sample), 't.html'), { type: 'SlideSelected', index: 1 });
    const sent: Msg[] = [];
    const dispatch = (msg: Msg) => {
      sent.push(msg);
      model = update(model, msg);
    };
    return { dispatch, sent, get model() { return model; } };
  }

  it('ImagesAdded → images/Inserted の順に送り、画像が置かれる。断ったファイルは知らせる', async () => {
    const r = runner();
    const notify = vi.fn();
    const before = r.model;
    await insertImageFiles([png('a.png'), png('bad.png'), png('c.png')], r.dispatch, deps, notify);

    expect(r.sent.map((m) => m.type)).toEqual(['ImagesAdded', 'images/Inserted']);
    const els = r.model.deck.slides[1].elements.slice(-2);
    expect(els.map((e) => e.tag)).toEqual(['img', 'img']);
    for (const el of els) expect(r.model.images[el.attrs.src]).toBeInstanceOf(File);
    expect(r.model.history.past.length).toBe(before.history.past.length + 1);
    expect(notify).toHaveBeenCalledWith([{ name: 'bad.png', reason: '画像として読めません（大きさを測れません）' }]);
  });

  it('全部断ったら Msg は送らず、知らせるだけ', async () => {
    const r = runner();
    const notify = vi.fn();
    await insertImageFiles([new File([], 'empty.png', { type: 'image/png' })], r.dispatch, deps, notify);
    expect(r.sent).toEqual([]);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('全部入れられたら知らせない', async () => {
    const r = runner();
    const notify = vi.fn();
    await insertImageFiles([png('a.png')], r.dispatch, deps, notify);
    expect(notify).not.toHaveBeenCalled();
  });
});
