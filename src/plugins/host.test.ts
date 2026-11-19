import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { getPluginState, setPluginState } from '../app/helpers';
import { initModel, type Model } from '../app/model';
import { update } from '../app/update';
import { parseDeck } from '../model/parse';
import * as pluginApi from '../plugin-api';
import { api, API_VERSION, isCompatible, type Exporter, type ExportInput, type Plugin } from '../plugin-api';
import { pluginContext } from '../app/store';
import sample from '../samples/sample-deck.html?raw';
import {
  checkMsgFromPlugin,
  exportersOf,
  listPlugins,
  MODEL_KEYS,
  pluginFromModule,
  registerPlugin,
  runExporter,
  setPluginEnabled,
  subscribePlugins,
  unregisterPlugin,
  type ReceivedExporter,
  type ReceivedPlugin,
} from './host';

const setup = () => initModel(parseDeck(sample), 't.html');

type CounterMsg = { type: 'counter/Added' } | { type: 'counter/Broken' };
const counter: Plugin<CounterMsg> = {
  name: 'counter',
  apiVersion: '1.0',
  update(model, msg) {
    switch (msg.type) {
      case 'counter/Added':
        return setPluginState(model, 'counter', (getPluginState<number>(model, 'counter') ?? 0) + 1);
      case 'counter/Broken':
        throw new Error('わざと');
    }
  },
  onKey: (_model, key) => (key.key === '+' ? { type: 'counter/Added' } : null),
};

const press = (model: Model, key: string) => update(model, { type: 'KeyPressed', key, shift: false, mod: false });

afterEach(() => {
  for (const { plugin } of listPlugins()) unregisterPlugin(plugin.name);
  vi.restoreAllMocks();
});

describe('isCompatible（API の版の互換性）', () => {
  it('メジャーが同じで、マイナーがアプリ以下なら動く', () => {
    expect(isCompatible('1.0', '1.2')).toBe(true);
    expect(isCompatible('1.2', '1.2')).toBe(true);
    expect(isCompatible('2.0', '1.2')).toBe(false);
  });

  it('アプリより新しいマイナーを前提にしたプラグインは動かない', () => {
    expect(isCompatible('1.3', '1.2')).toBe(false);
  });

  it('「メジャー.マイナー」の形でない版は動かない', () => {
    expect(isCompatible('1', '1.2')).toBe(false);
  });
});

describe('registerPlugin', () => {
  it('登録した順に一覧に並び、変わるたびに知らせる', () => {
    const listener = vi.fn();
    const off = subscribePlugins(listener);
    registerPlugin(counter, 'external');
    expect(listPlugins()).toEqual([{ plugin: counter, source: 'external', enabled: true }]);
    setPluginEnabled('counter', false);
    expect(listPlugins()[0].enabled).toBe(false);
    unregisterPlugin('counter');
    expect(listPlugins()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(3);
    off();
  });

  it('形が正しくないものは理由付きで断る', () => {
    expect(() => registerPlugin(null, 'external')).toThrow('オブジェクトではありません');
    expect(() => registerPlugin({ name: 'Bad Name', apiVersion: '1.0' }, 'external')).toThrow('プラグイン名');
    expect(() => registerPlugin({ name: 'a', apiVersion: '9.0' }, 'external')).toThrow('apiVersion（9.0）');
    expect(() => registerPlugin({ name: 'a', apiVersion: '1.0', update: 1 }, 'external')).toThrow('update が関数ではありません');
    expect(() => registerPlugin({ name: 'a', apiVersion: '1.0', toolbar: {} }, 'external')).toThrow('mount がありません');
    expect(() => registerPlugin({ name: 'a', apiVersion: '1.0', title: { x: 1 } }, 'external')).toThrow('title が文字列ではありません');
    expect(() => registerPlugin({ name: 'b', apiVersion: '1.0', description: 42 }, 'external')).toThrow('description が文字列ではありません');
    expect(listPlugins()).toEqual([]);
  });

  const badValueForEveryPluginFieldOrTypeError: Record<keyof Plugin, { value: unknown; message: string }> = {
    name: { value: 'Bad Name', message: 'プラグイン名' },
    apiVersion: { value: 1, message: 'apiVersion' },
    title: { value: { x: 1 }, message: 'title が文字列ではありません' },
    description: { value: 42, message: 'description が文字列ではありません' },
    update: { value: 1, message: 'update が関数ではありません' },
    onKey: { value: 'x', message: 'onKey が関数ではありません' },
    toolbar: { value: { mount: 1 }, message: 'mount がありません' },
    exporters: { value: 'html', message: 'exporters が配列ではありません' },
  };
  it('登録簿の Plugin（ReceivedPlugin）は、関数の欄の戻り値が unknown（確かめずに使うと型エラー。Step 7a audit-1 #2）。関数でない欄はそのまま', () => {
    expectTypeOf<ReturnType<NonNullable<ReceivedPlugin['update']>>>().toBeUnknown();
    expectTypeOf<ReturnType<NonNullable<ReceivedPlugin['onKey']>>>().toBeUnknown();
    expectTypeOf<ReceivedPlugin['name']>().toEqualTypeOf<string>();
  });

  it.each(Object.entries(badValueForEveryPluginFieldOrTypeError))('欄 %s に不正な値があれば断る（Plugin に欄を足すと、ここに書くまで型エラー。Step 6 の再発防止）', (key, { value, message }) => {
    expect(() => registerPlugin({ name: 'a', apiVersion: '1.0', [key]: value }, 'external')).toThrow(message);
    expect(listPlugins()).toEqual([]);
  });

  it('同じ名前は2つ登録できない', () => {
    registerPlugin(counter, 'builtin');
    expect(() => registerPlugin({ ...counter }, 'external')).toThrow('同じ名前のプラグインが既にあります: counter');
  });
});

describe('Msg の振り分け', () => {
  it('"名前/出来事" の Msg がそのプラグインの update に届き、プラグイン自身の状態を持てる', () => {
    registerPlugin(counter, 'external');
    const m = update(update(setup(), { type: 'counter/Added' }), { type: 'counter/Added' });
    expect(m.plugins.counter).toBe(2);
  });

  it('無効にしたプラグインには届かない', () => {
    registerPlugin(counter, 'external');
    setPluginEnabled('counter', false);
    const m0 = setup();
    expect(update(m0, { type: 'counter/Added' })).toBe(m0);
  });

  it('登録されていないプラグインの Msg は、Model を変えずに警告を出す', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m0 = setup();
    expect(update(m0, { type: 'nosuch/Thing' })).toBe(m0);
    expect(warn).toHaveBeenCalledWith('登録されていないプラグインの Msg: nosuch/Thing');
  });

  it('プラグインの update が例外を出しても、アプリは止まらず Model はそのまま', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPlugin(counter, 'external');
    const m0 = setup();
    expect(update(m0, { type: 'counter/Broken' })).toBe(m0);
    expect(error).toHaveBeenCalled();
  });

  it('update が Model を返さなくても、Model はそのまま', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPlugin({ name: 'bad', apiVersion: '1.0', update: () => undefined }, 'external');
    const m0 = setup();
    expect(update(m0, { type: 'bad/Thing' })).toBe(m0);
  });

  it('update が Model らしくないオブジェクトを返しても、Model はそのまま（Step 6 audit-1 #2）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPlugin({ name: 'bad', apiVersion: '1.0', update: () => ({}) }, 'external');
    const m0 = setup();
    expect(update(m0, { type: 'bad/Thing' })).toBe(m0);
  });

  it('update が images の無い Model を返しても、Model はそのまま（Step 8 audit-1 #4）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPlugin(
      { name: 'bad', apiVersion: '1.0', update: (m: Model) => ({ deck: m.deck, history: m.history }) },
      'external',
    );
    const m0 = setup();
    expect(update(m0, { type: 'bad/Thing' })).toBe(m0);
  });

  it('initModel が MODEL_KEYS のすべての欄を作っている（Model に欄を足すと、下のテストがその欄も確かめる）', () => {
    expect(Object.keys(setup()).sort()).toEqual(Object.keys(MODEL_KEYS).sort());
  });

  it('欄の値の型までは確かめない（deck の中身などは見ない。画面が中を読む deck・history・images がオブジェクトであることと、images の値が Blob であることだけ）', () => {
    registerPlugin({ name: 'loose', apiVersion: '1.0', update: (m: Model) => ({ ...m, current: 'not a number' }) }, 'external');
    expect(update(setup(), { type: 'loose/Thing' }).current).toBe('not a number');
  });

  it('update が images に Blob でない値を入れた Model を返したら断り、Model はそのまま（画面が blob: の URL を作るときに例外で落ちるため）', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPlugin(
      { name: 'bad', apiVersion: '1.0', update: (m: Model) => ({ ...m, images: { ...m.images, 'images/a.png': 'not a blob' } }) },
      'external',
    );
    const m0 = setup();
    expect(update(m0, { type: 'bad/Thing' })).toBe(m0);
    expect(error).toHaveBeenCalled();
  });

  it('images のキーが画像のパスかまでは確かめない（画面は img の src と同じキーしか読まないので、余分なキーがあっても落ちない）。Blob の値なら受け入れる', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    registerPlugin(
      { name: 'loose', apiVersion: '1.0', update: (m: Model) => ({ ...m, images: { ...m.images, 'not/an/image-path': blob } }) },
      'external',
    );
    expect(update(setup(), { type: 'loose/Thing' }).images).toEqual({ 'not/an/image-path': blob });
  });

  it.each(Object.keys(MODEL_KEYS))('update が欄 %s の無い Model を返したら断り、Model はそのまま（Step 8 audit-1 #4）', (key) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPlugin(
      {
        name: 'bad',
        apiVersion: '1.0',
        update: (m: Model) => {
          const copy: Record<string, unknown> = { ...m };
          delete copy[key];
          return copy as unknown as Model;
        },
      },
      'external',
    );
    const m0 = setup();
    expect(update(m0, { type: 'bad/Thing' })).toBe(m0);
  });

  it('全部の欄がある Model なら受け入れる（抜けた欄のテストが「何でも断る」で通っていないことの確認）', () => {
    registerPlugin({ name: 'ok', apiVersion: '1.0', update: (m: Model) => ({ ...m, current: 1 }) }, 'external');
    expect(update(setup(), { type: 'ok/Thing' }).current).toBe(1);
  });

  it('別のファイルを開いても、プラグイン自身の状態は残る', () => {
    registerPlugin(counter, 'external');
    const m = update(setup(), { type: 'counter/Added' });
    const loaded = update(m, { type: 'DeckLoaded', deck: parseDeck(sample), fileName: 'b.html' });
    expect(loaded.plugins.counter).toBe(1);
  });
});

describe('onKey', () => {
  it('土台が扱わないキーがプラグインに届き、返した Msg が処理される', () => {
    registerPlugin(counter, 'external');
    expect(press(setup(), '+').plugins.counter).toBe(1);
  });

  it('土台が扱うキーは届かない（何も選んでいない ↓ はスライド移動）', () => {
    const onKey = vi.fn(() => null);
    registerPlugin({ name: 'spy', apiVersion: '1.0', onKey }, 'external');
    expect(press(setup(), 'ArrowDown').current).toBe(1);
    expect(onKey).not.toHaveBeenCalled();
  });

  it('無効にしたプラグイン・例外を出すプラグインは飛ばして、次のプラグインに聞く', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPlugin({ name: 'broken', apiVersion: '1.0', onKey: () => { throw new Error('わざと'); } }, 'external');
    registerPlugin({ ...counter, name: 'off', update: undefined }, 'external');
    setPluginEnabled('off', false);
    registerPlugin(counter, 'external');
    expect(press(setup(), '+').plugins.counter).toBe(1);
  });

  it('onKey が土台の Msg（KeyPressed）を返しても無限に呼び合わず、次のプラグインに聞く（Step 6 audit-1 #3）', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPlugin(
      { name: 'loop', apiVersion: '1.0', onKey: (_m: unknown, key: object) => ({ type: 'KeyPressed', ...key }) },
      'external',
    );
    registerPlugin(counter, 'external');
    expect(press(setup(), '+').plugins.counter).toBe(1);
    expect(error).toHaveBeenCalled();
  });
});

describe('checkMsgFromPlugin（部品が dispatch した値）', () => {
  it('type が文字列のオブジェクトだけを通す', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(checkMsgFromPlugin({ type: 'counter/Added' })).toBe(true);
    expect(checkMsgFromPlugin({ type: 'Undo' })).toBe(true);
    for (const bad of [null, undefined, 'Undo', 5, {}, { type: 5 }]) expect(checkMsgFromPlugin(bad)).toBe(false);
    expect(error).toHaveBeenCalledTimes(6);
  });
});

describe('onKey の戻り値', () => {
  it('Msg の形でない値（文字列・type の無いオブジェクト）は飛ばして、次のプラグインに聞く', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registerPlugin({ name: 'str', apiVersion: '1.0', onKey: () => 'counter/Added' }, 'external');
    registerPlugin({ name: 'obj', apiVersion: '1.0', onKey: () => ({ type: 7 }) }, 'external');
    registerPlugin(counter, 'external');
    expect(press(setup(), '+').plugins.counter).toBe(1);
  });
});

describe('plugin-api', () => {
  it('外部プラグインに渡す api と、名前付きで export している関数が同じ一覧になっている（Step 6 audit-1 #4）', () => {
    const exported = Object.entries(pluginApi)
      .filter(([name, value]) => typeof value === 'function' && name !== 'isCompatible')
      .map(([name]) => name)
      .sort();
    const inApi = Object.keys(api)
      .filter((name) => name !== 'version')
      .sort();
    expect(inApi).toEqual(exported);
  });
});

describe('API 1.5（書き出しの形式 exporters を足した）の後方互換', () => {
  it.each(['1.0', '1.1', '1.2', '1.3', '1.4'])('apiVersion %s のプラグインも登録でき、exporters の無いプラグインの部品はそのまま動き、書き出しの一覧には出ない', (version) => {
    expect(API_VERSION).toBe('1.5');
    const container = document.createElement('div');
    const plugin = registerPlugin(
      {
        name: 'old',
        apiVersion: version,
        toolbar: {
          mount(el: HTMLElement, ctx: { getModel(): Model }) {
            el.textContent = String(ctx.getModel().current);
            return () => el.replaceChildren();
          },
        },
      },
      'external',
    );
    const unmount = plugin.toolbar!.mount(container, pluginContext);
    expect(container.textContent).toBe('0');
    unmount();
    expect(container.textContent).toBe('');
    expect(exportersOf(listPlugins())).toEqual([]);
  });
});

const ICON = '<svg viewBox="0 0 24 24"><path d="M2 3h20"/></svg>';
const textExporter: Exporter = {
  id: 'text',
  title: 'テキスト',
  extension: 'txt',
  mimeType: 'text/plain',
  icon: ICON,
  export: ({ deck }) => new Blob([String(deck.slides.length)], { type: 'text/plain' }),
};
const withExporters = (exporters: unknown, name = 'exp') => ({ name, apiVersion: '1.5', exporters });
const input = (): ExportInput => ({ deck: setup().deck, images: {}, fileName: 't.html' });

describe('書き出しの形式（Plugin の exporters。API 1.5）', () => {
  it('登録した書き出しの形式が、有効なプラグインの分だけ登録順に一覧に出る', () => {
    const pdf = { ...textExporter, id: 'pdf', title: 'PDF', extension: 'pdf', mimeType: 'application/pdf', icon: undefined };
    registerPlugin(withExporters([textExporter, pdf], 'first'), 'external');
    registerPlugin(withExporters([textExporter], 'second'), 'external');
    const ids = () => exportersOf(listPlugins()).map((e) => `${e.pluginName}:${e.exporter.id}`);
    expect(ids()).toEqual(['first:text', 'first:pdf', 'second:text']);
    setPluginEnabled('first', false);
    expect(ids()).toEqual(['second:text']);
  });

  it('登録簿の書き出しの形式（ReceivedExporter）は、export の戻り値が unknown（確かめずに使うと型エラー）', () => {
    expectTypeOf<ReturnType<ReceivedExporter['export']>>().toBeUnknown();
  });

  const badValueForEveryExporterFieldOrTypeError: Record<keyof Exporter, { value: unknown; message: string }> = {
    id: { value: 'Bad Id', message: 'id は英小文字で始まる' },
    title: { value: 3, message: 'title が空でない文字列ではありません' },
    extension: { value: '.html', message: 'extension は英小文字・数字' },
    mimeType: { value: 'html', message: 'mimeType が MIME 型' },
    icon: { value: '<img src=x>', message: 'icon が SVG の文字列ではありません' },
    export: { value: 'go', message: 'export が関数ではありません' },
  };

  it.each(Object.entries(badValueForEveryExporterFieldOrTypeError))('書き出しの形式の欄 %s に不正な値があれば、プラグインごと断る（Exporter に欄を足すと、ここに書くまで型エラー）', (key, { value, message }) => {
    expect(() => registerPlugin(withExporters([{ ...textExporter, [key]: value }]), 'external')).toThrow(message);
    expect(listPlugins()).toEqual([]);
  });

  it.each([
    ['欄が欠けている（title）', { ...textExporter, title: undefined }, 'title が空でない文字列ではありません'],
    ['title が空', { ...textExporter, title: '' }, 'title が空でない文字列ではありません'],
    ['オブジェクトでない項目', 'text', 'exporters[0] がオブジェクトではありません'],
    ['null の項目', null, 'exporters[0] がオブジェクトではありません'],
  ])('%s は断る', (_, item, message) => {
    expect(() => registerPlugin(withExporters([item]), 'external')).toThrow(message);
    expect(listPlugins()).toEqual([]);
  });

  it('同じプラグインの中で id が重なっていたら断る（どちらを選んだかがわからなくなるため）', () => {
    expect(() => registerPlugin(withExporters([textExporter, { ...textExporter }]), 'external')).toThrow('exporters の id が重なっています: text');
  });

  it('icon は省いてよい（土台の既定のアイコンを出す）', () => {
    const plugin = registerPlugin(withExporters([{ ...textExporter, icon: undefined }]), 'external');
    expect(plugin.exporters?.[0].icon).toBeUndefined();
  });

  it('icon の SVG の中身（属性やスクリプト）までは確かめない（外部プラグインはアプリと同じ権限で動き、信頼できるものだけを入れる前提のため）', () => {
    const svgWithHandler = '<svg onload="void 0"><path d="M0 0"/></svg>';
    const plugin = registerPlugin(withExporters([{ ...textExporter, icon: svgWithHandler }]), 'external');
    expect(plugin.exporters?.[0].icon).toBe(svgWithHandler);
  });
});

describe('runExporter（書き出しの形式の export を呼ぶ）', () => {
  const entryOf = (exporter: unknown) => {
    registerPlugin(withExporters([{ ...textExporter, export: exporter }]), 'external');
    return exportersOf(listPlugins())[0];
  };

  it('Blob を返せばそれを使い、Deck・画像・ファイル名を渡す', async () => {
    const spy = vi.fn(() => new Blob(['ok']));
    const given = input();
    const blob = await runExporter(entryOf(spy), given);
    expect(await blob.text()).toBe('ok');
    expect(spy).toHaveBeenCalledWith(given);
  });

  it('Promise で Blob を返してもよい', async () => {
    const blob = await runExporter(entryOf(async () => new Blob(['later'])), input());
    expect(await blob.text()).toBe('later');
  });

  it.each([
    ['文字列', () => 'not a blob'],
    ['undefined', () => undefined],
    ['Blob でない値の Promise', async () => ({ size: 1 })],
  ])('Blob でない値（%s）を返したら、理由付きで断る', async (_, exporter) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(runExporter(entryOf(exporter), input())).rejects.toThrow('Blob を返しませんでした');
    expect(error).toHaveBeenCalled();
  });

  it.each([
    ['例外を出す', () => { throw new Error('わざと'); }],
    ['失敗する Promise を返す', () => Promise.reject(new Error('わざと'))],
  ])('export が%sときは、理由付きで断り、アプリは止まらない', async (_, exporter) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(runExporter(entryOf(exporter), input())).rejects.toThrow('でエラーが起きました（詳しくはコンソール）');
    expect(error).toHaveBeenCalled();
  });
});

describe('pluginFromModule（外部プラグインのモジュール）', () => {
  it('default export が関数なら API を渡して呼ぶ', () => {
    const factory = vi.fn(() => counter);
    expect(pluginFromModule({ default: factory }, api)).toBe(counter);
    expect(factory).toHaveBeenCalledWith(api);
  });

  it('default export がオブジェクトならそのまま使う', () => {
    expect(pluginFromModule({ default: counter }, api)).toBe(counter);
  });

  it('default export が無ければ断る', () => {
    expect(() => pluginFromModule({}, api)).toThrow('export default がありません');
  });
});
