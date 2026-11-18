import { images } from './plugin';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initModel, type Model } from '../../app/model';
import type { Msg } from '../../app/msg';
import { update } from '../../app/update';
import { parseDeck } from '../../model/parse';
import type { PluginContext } from '../../plugin-api';
import sample from '../../samples/sample-deck.html?raw';
import { registerPlugin } from '../host';
import { filesOf, isFileDrag, listenPasteAndDrop } from './events';

registerPlugin(images, 'builtin');

const png = (name: string) => new File([name], name, { type: 'image/png' });
const fakeInsert = () => vi.fn<(files: File[], dispatch: PluginContext['dispatch']) => Promise<void>>(async () => {});

function minimalContextRunningBaseUpdate(initial?: Model) {
  let model: Model =
    initial ?? update(initModel(parseDeck(sample), 't.html'), { type: 'SlideSelected', index: 1 });
  const ctx: PluginContext = {
    getModel: () => model,
    dispatch: (msg: Msg) => {
      model = update(model, msg);
    },
    subscribe: () => () => {},
    slideArea: () => slideArea,
  };
  return { ctx, setModel: (m: Model) => (model = m) };
}

function dataTransferStubSinceJsdomHasNone(files: File[], types = files.length > 0 ? ['Files'] : ['text/plain']) {
  return { files, items: [], types, dropEffect: 'none' } as unknown as DataTransfer;
}

function paste(target: EventTarget, files: File[]) {
  const e = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'clipboardData', { value: dataTransferStubSinceJsdomHasNone(files) });
  target.dispatchEvent(e);
  return e;
}

function drag(type: 'dragover' | 'drop', target: EventTarget, data: DataTransfer) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'dataTransfer', { value: data });
  target.dispatchEvent(e);
  return e;
}

let slideArea: HTMLElement | null;
let canvas: HTMLElement;
let outside: HTMLElement;

beforeEach(() => {
  const areaWithoutAnyBaseClassName = document.createElement('main');
  slideArea = areaWithoutAnyBaseClassName;
  canvas = document.createElement('div');
  areaWithoutAnyBaseClassName.append(canvas);
  outside = document.createElement('aside');
  document.body.append(areaWithoutAnyBaseClassName, outside);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('filesOf / isFileDrag', () => {
  it('files が空なら items のファイルを使う。無ければ空', () => {
    const f = png('a.png');
    const items = [
      { kind: 'string', getAsFile: () => null },
      { kind: 'file', getAsFile: () => f },
    ];
    expect(filesOf({ files: [], items, types: [] } as unknown as DataTransfer)).toEqual([f]);
    expect(filesOf(null)).toEqual([]);
    expect(isFileDrag(dataTransferStubSinceJsdomHasNone([f]))).toBe(true);
    expect(isFileDrag(dataTransferStubSinceJsdomHasNone([]))).toBe(false);
    expect(isFileDrag(null)).toBe(false);
  });
});

describe('貼り付け', () => {
  it('画像があれば横取りして挿入する（ブラウザの既定の動作は止める）', () => {
    const insert = fakeInsert();
    const stop = listenPasteAndDrop(minimalContextRunningBaseUpdate().ctx, insert);
    const f = png('a.png');
    const e = paste(canvas, [f]);
    expect(insert).toHaveBeenCalledWith([f], expect.any(Function));
    expect(e.defaultPrevented).toBe(true);
    stop();
  });

  it('画像が無い（文字だけ・画像でないファイルだけ）なら何もしない', () => {
    const insert = fakeInsert();
    const stop = listenPasteAndDrop(minimalContextRunningBaseUpdate().ctx, insert);
    expect(paste(canvas, []).defaultPrevented).toBe(false);
    expect(paste(canvas, [new File(['x'], 'a.txt', { type: 'text/plain' })]).defaultPrevented).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    stop();
  });

  it('テキスト編集中・入力欄・contentEditable への貼り付けはブラウザに任せる', () => {
    const insert = fakeInsert();
    const { ctx, setModel } = minimalContextRunningBaseUpdate();
    const stop = listenPasteAndDrop(ctx, insert);

    const textarea = document.createElement('textarea');
    const input = document.createElement('input');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    const jsdomLacksIsContentEditable = { value: true };
    Object.defineProperty(editable, 'isContentEditable', jsdomLacksIsContentEditable);
    outside.append(textarea, input, editable);
    for (const target of [textarea, input, editable]) expect(paste(target, [png('a.png')]).defaultPrevented).toBe(false);

    const m = ctx.getModel();
    setModel(update(m, { type: 'EditRequested', id: m.deck.slides[1].elements[0].id }));
    expect(ctx.getModel().editingId).not.toBeNull();
    expect(paste(canvas, [png('a.png')]).defaultPrevented).toBe(false);

    expect(insert).not.toHaveBeenCalled();
    stop();
  });

  it('スライドが 0 枚なら入れない', () => {
    const insert = fakeInsert();
    const stop = listenPasteAndDrop(minimalContextRunningBaseUpdate(initModel(parseDeck('<body></body>'), 'e.html')).ctx, insert);
    expect(paste(canvas, [png('a.png')]).defaultPrevented).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    stop();
  });
});

describe('ドロップ', () => {
  it('作業領域にファイルを落とすと挿入する。ドラッグ中は作業領域に色の面を重ねる', () => {
    const insert = fakeInsert();
    const stop = listenPasteAndDrop(minimalContextRunningBaseUpdate().ctx, insert);
    const highlight = document.querySelector<HTMLElement>('.images-drop-highlight')!;
    expect(highlight.hidden).toBe(true);

    const data = dataTransferStubSinceJsdomHasNone([png('a.png')]);
    expect(drag('dragover', canvas, data).defaultPrevented).toBe(true);
    expect(data.dropEffect).toBe('copy');
    expect(highlight.hidden).toBe(false);

    const e = drag('drop', canvas, data);
    expect(e.defaultPrevented).toBe(true);
    expect(insert).toHaveBeenCalledWith(data.files, expect.any(Function));
    expect(highlight.hidden).toBe(true);
    stop();
  });

  it('作業領域から出たら色の面を消す', () => {
    const stop = listenPasteAndDrop(minimalContextRunningBaseUpdate().ctx, fakeInsert());
    const highlight = document.querySelector<HTMLElement>('.images-drop-highlight')!;
    drag('dragover', canvas, dataTransferStubSinceJsdomHasNone([png('a.png')]));
    expect(highlight.hidden).toBe(false);
    const leftWindowSoNoRelatedTarget = new Event('dragleave');
    window.dispatchEvent(leftWindowSoNoRelatedTarget);
    expect(highlight.hidden).toBe(true);
    stop();
  });

  it('作業領域の外に落としたら入れないが、ブラウザがファイルを開く既定の動作は止める', () => {
    const insert = fakeInsert();
    const stop = listenPasteAndDrop(minimalContextRunningBaseUpdate().ctx, insert);
    const data = dataTransferStubSinceJsdomHasNone([png('a.png')]);
    expect(drag('dragover', outside, data).defaultPrevented).toBe(true);
    expect(data.dropEffect).toBe('none');
    expect(drag('drop', outside, data).defaultPrevented).toBe(true);
    expect(insert).not.toHaveBeenCalled();
    stop();
  });

  it('ファイル以外（テキストなど）のドラッグ・ドロップは無視し、邪魔もしない', () => {
    const insert = fakeInsert();
    const stop = listenPasteAndDrop(minimalContextRunningBaseUpdate().ctx, insert);
    const text = dataTransferStubSinceJsdomHasNone([]);
    expect(drag('dragover', canvas, text).defaultPrevented).toBe(false);
    expect(drag('drop', canvas, text).defaultPrevented).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    stop();
  });

  it('ドロップ先は ctx.slideArea() が返す要素で決まる。null（スライドの表示領域が無い）ならどこに落としても入れない', () => {
    const insert = fakeInsert();
    slideArea = null;
    const stop = listenPasteAndDrop(minimalContextRunningBaseUpdate().ctx, insert);
    const data = dataTransferStubSinceJsdomHasNone([png('a.png')]);
    expect(drag('dragover', canvas, data).defaultPrevented).toBe(true);
    expect(data.dropEffect).toBe('none');
    drag('drop', canvas, data);
    expect(insert).not.toHaveBeenCalled();
    stop();
  });

  it('画像のプラグインのコードは土台の内部のクラス名（.stage など）を使わない（ドロップ先は plugin-api の ctx.slideArea から得る）', () => {
    const sources = import.meta.glob(['./*.ts', './*.tsx', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true });
    expect(Object.keys(sources).length).toBeGreaterThan(0);
    for (const [file, text] of Object.entries(sources)) {
      expect(String(text), file).not.toMatch(/['"`.]stage\b/);
    }
  });

  it('テキスト編集中は入れない', () => {
    const insert = fakeInsert();
    const { ctx, setModel } = minimalContextRunningBaseUpdate();
    const m = ctx.getModel();
    setModel(update(m, { type: 'EditRequested', id: m.deck.slides[1].elements[0].id }));
    const stop = listenPasteAndDrop(ctx, insert);
    const data = dataTransferStubSinceJsdomHasNone([png('a.png')]);
    drag('dragover', canvas, data);
    expect(data.dropEffect).toBe('none');
    drag('drop', canvas, data);
    expect(insert).not.toHaveBeenCalled();
    stop();
  });
});

describe('登録と片付け', () => {
  it('片付けたら、貼り付け・ドロップに反応せず、色の面も消える', () => {
    const insert = fakeInsert();
    const stop = listenPasteAndDrop(minimalContextRunningBaseUpdate().ctx, insert);
    stop();
    expect(document.querySelector('.images-drop-highlight')).toBeNull();
    expect(paste(canvas, [png('a.png')]).defaultPrevented).toBe(false);
    expect(drag('drop', canvas, dataTransferStubSinceJsdomHasNone([png('a.png')])).defaultPrevented).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('プラグインの部品の mount で受け付けを始め、unmount（一覧で無効にしたとき）で必ず外す', async () => {
    const silenceRejectionSinceJsdomCannotReadImages = () => {
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    };
    silenceRejectionSinceJsdomCannotReadImages();
    const container = document.createElement('div');
    document.body.append(container);
    const unmount = images.toolbar!.mount(container, minimalContextRunningBaseUpdate().ctx);
    expect(paste(canvas, [png('a.png')]).defaultPrevented).toBe(true);
    expect(document.querySelectorAll('.images-drop-highlight')).toHaveLength(1);

    unmount();
    expect(paste(canvas, [png('a.png')]).defaultPrevented).toBe(false);
    expect(drag('drop', canvas, dataTransferStubSinceJsdomHasNone([png('a.png')])).defaultPrevented).toBe(false);
    expect(document.querySelector('.images-drop-highlight')).toBeNull();
    const waitForReactViewQueuedUnmount = () => new Promise((r) => setTimeout(r));
    await waitForReactViewQueuedUnmount();
  });
});
