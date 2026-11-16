import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPluginState, setPluginState } from '../app/helpers';
import { initModel, type Model } from '../app/model';
import { update } from '../app/update';
import { parseDeck } from '../model/parse';
import { api, isCompatible, type Plugin } from '../plugin-api';
import sample from '../samples/sample-deck.html?raw';
import {
  listPlugins,
  pluginFromModule,
  registerPlugin,
  setPluginEnabled,
  subscribePlugins,
  unregisterPlugin,
} from './host';

const setup = () => initModel(parseDeck(sample), 't.html');

/** テスト用のプラグイン: 'counter/Added' で自分の状態の数を1増やす。'+' キーで同じことをする */
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
    expect(isCompatible('1.3', '1.2')).toBe(false); // アプリより新しい API を前提にしている
    expect(isCompatible('2.0', '1.2')).toBe(false);
    expect(isCompatible('1', '1.2')).toBe(false); // 形が違う
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
