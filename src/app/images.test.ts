// images/ の画像の中身（Model.images）と、それを扱う Msg のテスト。

import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertElement } from '../model/commands';
import { parseDeck } from '../model/parse';
import { edit } from './helpers';
import { initModel, isDirty, needsFolderAccess, type Model } from './model';
import type { Msg } from './msg';
import { update } from './update';

const A = `images/${'a'.repeat(64)}.png`;
const B = `images/${'b'.repeat(64)}.jpg`;

const deckWith = (...srcs: string[]) =>
  parseDeck(`<body><section data-layout="blank">${srcs.map((s) => `<img data-el src="${s}">`).join('')}</section></body>`);

const png = (text = 'x') => new Blob([text], { type: 'image/png' });

/** 画像を2つ使うデッキを、フォルダを読める状態で開いた Model */
const opened = (): Model =>
  update(initModel(deckWith(), 'x.html'), { type: 'DeckLoaded', deck: deckWith(A, B), fileName: 'a.html', canReadFolder: true });

const run = (model: Model, ...msgs: Msg[]) => msgs.reduce(update, model);

afterEach(() => vi.restoreAllMocks());

describe('ImagesAdded', () => {
  it('届いた画像を Model.images に加える', () => {
    const a = png();
    const m = update(opened(), { type: 'ImagesAdded', images: { [A]: a } });
    expect(m.images).toEqual({ [A]: a });
    expect(m.images[A]).toBe(a);
  });

  it('すでに持っている画像は上書きしない。新しいものが無ければ Model をそのまま返す', () => {
    const first = png('first');
    const m1 = update(opened(), { type: 'ImagesAdded', images: { [A]: first } });
    const m2 = update(m1, { type: 'ImagesAdded', images: { [A]: png('second') } });
    expect(m2).toBe(m1);
    const b = png();
    const m3 = update(m1, { type: 'ImagesAdded', images: { [A]: png('second'), [B]: b } });
    expect(m3.images[A]).toBe(first);
    expect(m3.images[B]).toBe(b);
  });

  it('Deck・履歴・未保存の判定に影響しない', () => {
    const m0 = opened();
    const m = update(m0, { type: 'ImagesAdded', images: { [A]: png() } });
    expect(m.deck).toBe(m0.deck);
    expect(m.history).toBe(m0.history);
    expect(isDirty(m)).toBe(false);
  });

  it('元に戻しても画像は残る（画像を置く操作を戻してから、やり直しても表示できる）', () => {
    const m0 = opened();
    const withImage = run(m0, { type: 'ImagesAdded', images: { [A]: png() } });
    const inserted = edit(withImage, insertElement(withImage.deck, withImage.deck.slides[0].id, { id: 'n1', tag: 'img', rect: {}, style: '', attrs: { src: A }, html: '' }));
    const undone = update(inserted, { type: 'Undo' });
    expect(undone.images[A]).toBeDefined();
    expect(update(undone, { type: 'Redo' }).images[A]).toBeDefined();
  });

  it('外から来る値: パスでないキー・Blob でない値の項目は捨て、残りは受け入れる。理由はコンソールへ', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = png();
    const bad = { [A]: a, 'images/../x.png': png(), [B]: 'not a blob', 'images/c.png': null } as unknown as Record<string, Blob>;
    const m = update(opened(), { type: 'ImagesAdded', images: bad });
    expect(m.images).toEqual({ [A]: a });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('外から来る値: images がオブジェクトでなければ何も変えない（落ちない）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const m0 = opened();
    for (const bad of [undefined, null, 'images/a.png', 42, [png()]]) {
      expect(update(m0, { type: 'ImagesAdded', images: bad } as unknown as Msg)).toBe(m0);
    }
  });
});

describe('別のファイルを開く・保存する', () => {
  it('DeckLoaded で画像は空になり、フォルダを読めるかは Msg の値になる（省略なら false）', () => {
    const m = update(opened(), { type: 'ImagesAdded', images: { [A]: png() } });
    const loaded = update(m, { type: 'DeckLoaded', deck: deckWith(A), fileName: 'b.html' });
    expect(loaded.images).toEqual({});
    expect(loaded.canReadFolder).toBe(false);
  });

  it('DeckSaved は画像を残し、フォルダを読めるかは値があれば更新する', () => {
    const m = update(opened(), { type: 'ImagesAdded', images: { [A]: png() } });
    const saved = update(m, { type: 'DeckSaved', deck: m.deck, fileName: 'c.html' });
    expect(saved.images).toBe(m.images);
    expect(saved.canReadFolder).toBe(true);
    expect(update(m, { type: 'DeckSaved', deck: m.deck, fileName: 'c.html', canReadFolder: false }).canReadFolder).toBe(false);
  });
});

describe('needsFolderAccess（「フォルダへのアクセスを許可」を出すか）', () => {
  it('フォルダを読めて、中身の無い画像があるときだけ true', () => {
    const m0 = opened();
    expect(needsFolderAccess(m0)).toBe(true);
    const half = update(m0, { type: 'ImagesAdded', images: { [A]: png() } });
    expect(needsFolderAccess(half)).toBe(true);
    const all = update(half, { type: 'ImagesAdded', images: { [B]: png() } });
    expect(needsFolderAccess(all)).toBe(false);
  });

  it('場所のわからないファイル（<input> で開いた・サンプル）では出さない', () => {
    const m = update(opened(), { type: 'DeckLoaded', deck: deckWith(A), fileName: 'b.html', canReadFolder: false });
    expect(needsFolderAccess(m)).toBe(false);
  });

  it('images/ の画像を使っていなければ出さない（data URI・管理対象外のパスだけ）', () => {
    const deck = deckWith('data:image/png;base64,AAAA', 'images/../x.png', 'https://example.com/a.png');
    const m = update(opened(), { type: 'DeckLoaded', deck, fileName: 'b.html', canReadFolder: true });
    expect(needsFolderAccess(m)).toBe(false);
  });
});
