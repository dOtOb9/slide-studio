// プラグインホスト: 実行時にプラグインを登録し、有効なものに Msg・キー・ツールバーを回す。
//
// 同梱のプラグイン（builtin.ts の一覧）も、外部から読み込んだプラグインも、同じ registerPlugin で登録する
// （Unreal Engine の Engine Plugins と Project Plugins が同じ仕組みで動くのと同じ考え方）。
//
// 登録簿は store と同じく「ランタイム」の一部で、Model には入れない（プラグインは関数を持ち、保存も
// 元に戻すもしないため）。React には依存しない。画面は subscribePlugins で変更を知る。
//
// プラグインの不具合でアプリ全体が止まらないよう、プラグインの関数は try / catch で囲んで呼ぶ。
// 例外が出たら、その Msg は無かったことにして（Model をそのまま返して）コンソールに出す。

import type { Model } from '../app/model';
import type { KeyInput, Msg, PluginMsg } from '../app/msg';
import { API_VERSION, isCompatible, type Plugin, type PluginApi } from '../plugin-api';

/** 同梱（アプリと一緒に配る）か、外部（後から読み込んだ）か */
export type PluginSource = 'builtin' | 'external';

export interface PluginEntry {
  plugin: Plugin;
  source: PluginSource;
  enabled: boolean;
}

// 登録簿。変えるときは配列ごと新しく作る（画面が「変わったか」を参照の比較で知れるように）
let entries: readonly PluginEntry[] = [];
const listeners = new Set<() => void>();

function setEntries(next: readonly PluginEntry[]) {
  entries = next;
  listeners.forEach((listener) => listener());
}

// --- 登録・取り外し・有効／無効 ----------------------------------------------------

/**
 * プラグインを登録する。形が正しくない・版が合わない・名前が重なるときは例外を投げる
 * （外部プラグインは型の確認を通っていないので、実行時に確かめる）
 */
export function registerPlugin(value: unknown, source: PluginSource): Plugin {
  const plugin = validatePlugin(value);
  if (entries.some((e) => e.plugin.name === plugin.name)) {
    throw new Error(`同じ名前のプラグインが既にあります: ${plugin.name}`);
  }
  setEntries([...entries, { plugin, source, enabled: true }]);
  return plugin;
}

export function unregisterPlugin(name: string) {
  setEntries(entries.filter((e) => e.plugin.name !== name));
}

export function setPluginEnabled(name: string, enabled: boolean) {
  setEntries(entries.map((e) => (e.plugin.name === name ? { ...e, enabled } : e)));
}

/** 登録されているプラグインの一覧（無効のものも含む。登録した順） */
export function listPlugins(): readonly PluginEntry[] {
  return entries;
}

/** 一覧が変わるたびに呼ばれる関数を登録する。戻り値を呼ぶと登録を外す */
export function subscribePlugins(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// --- 外部プラグインのモジュールから Plugin を取り出す ---------------------------------------

/**
 * import() したモジュールから Plugin を取り出す。外部プラグインは次のどちらかを default export する:
 *   - (api) => Plugin … アプリの API を引数で受け取る関数（ふつうはこちら）
 *   - Plugin          … API を使わないなら、オブジェクトそのままでもよい
 */
export function pluginFromModule(mod: unknown, api: PluginApi): unknown {
  const value = (mod as { default?: unknown } | null)?.default;
  if (typeof value === 'function') return value(api);
  if (value) return value;
  throw new Error('プラグインのファイルに export default がありません');
}

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function validatePlugin(value: unknown): Plugin {
  if (!value || typeof value !== 'object') throw new Error('プラグインがオブジェクトではありません');
  const p = value as Record<string, unknown>;
  if (typeof p.name !== 'string' || !NAME_PATTERN.test(p.name)) {
    throw new Error(`プラグイン名は英小文字で始まる英小文字・数字・ハイフンにしてください: ${String(p.name)}`);
  }
  if (typeof p.apiVersion !== 'string' || !isCompatible(p.apiVersion)) {
    throw new Error(`プラグイン ${p.name} の apiVersion（${String(p.apiVersion)}）はこのアプリ（${API_VERSION}）で動きません`);
  }
  // 一覧の画面にそのまま描くので、文字列でないと画面全体が落ちる
  for (const key of ['title', 'description'] as const) {
    if (p[key] !== undefined && typeof p[key] !== 'string') {
      throw new Error(`プラグイン ${p.name} の ${key} が文字列ではありません`);
    }
  }
  for (const key of ['update', 'onKey'] as const) {
    if (p[key] !== undefined && typeof p[key] !== 'function') {
      throw new Error(`プラグイン ${p.name} の ${key} が関数ではありません`);
    }
  }
  const toolbar = p.toolbar as { mount?: unknown } | undefined;
  if (toolbar !== undefined && typeof toolbar?.mount !== 'function') {
    throw new Error(`プラグイン ${p.name} の toolbar に mount がありません`);
  }
  return value as Plugin;
}

// --- update から呼ばれる部分 ---------------------------------------------------------

/** "/" を含む type はプラグインの Msg（土台の Msg は "/" を含まない） */
export function isPluginMsg(msg: Msg): msg is PluginMsg {
  return msg.type.includes('/');
}

/** Msg の type の "/" より前を見て、そのプラグインの update に渡す */
export function updatePlugin(model: Model, msg: PluginMsg): Model {
  const name = msg.type.slice(0, msg.type.indexOf('/'));
  const entry = entries.find((e) => e.plugin.name === name);
  if (!entry) {
    // プラグイン名と Msg の接頭辞が食い違っているか、取り外した後に部品から届いた。黙って捨てずに知らせる
    console.warn(`登録されていないプラグインの Msg: ${msg.type}`);
    return model;
  }
  const { plugin, enabled } = entry;
  if (!enabled || !plugin.update) return model;
  const next = callPlugin(plugin, () => plugin.update!(model, msg));
  if (next === undefined) return model;
  if (!looksLikeModel(next)) {
    console.error(`プラグイン ${plugin.name} の update が Model を返しませんでした`);
    return model;
  }
  return next;
}

/**
 * Model らしい形か（最低限の確認）。外部プラグインの update が {} などを返すと、
 * 画面のあちこちが model.deck や model.history を読んで落ちるため
 */
function looksLikeModel(value: unknown): value is Model {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<Model>;
  return typeof m.deck === 'object' && m.deck !== null && typeof m.history === 'object' && m.history !== null;
}

/** 土台が扱わなかったキーを、有効なプラグインに順に聞く。どれかが Msg を返したら、それを update で処理する */
export function pluginKey(model: Model, key: KeyInput, update: (model: Model, msg: Msg) => Model): Model | null {
  for (const { plugin, enabled } of entries) {
    if (!enabled || !plugin.onKey) continue;
    const msg = callPlugin(plugin, () => plugin.onKey!(model, key));
    if (msg === null || msg === undefined) continue;
    // 返してよいのはプラグインの Msg だけ。土台の KeyPressed などを返されると、
    // update → pluginKey → update … と無限に呼び合ってしまう
    if (!looksLikeMsg(msg) || !isPluginMsg(msg)) {
      console.error(`プラグイン ${plugin.name} の onKey がプラグインの Msg ではないものを返しました`, msg);
      continue;
    }
    return update(model, msg);
  }
  return null;
}

/**
 * プラグインの部品が ctx.dispatch に渡した値を確かめる（store の pluginContext から呼ぶ）。
 * Msg の形（type が文字列のオブジェクト）でなければ捨てて知らせる。
 * プラグインの Msg なら、その結果は updatePlugin が looksLikeModel で確かめる。
 * 土台の Msg（Undo など）は中身（deck などの欄）までは確かめない。
 */
export function checkMsgFromPlugin(value: unknown): value is Msg {
  if (looksLikeMsg(value)) return true;
  console.error('プラグインの部品が Msg ではないものを dispatch しました', value);
  return false;
}

/** Msg の形か（type が文字列のオブジェクト） */
function looksLikeMsg(value: unknown): value is Msg {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

/**
 * プラグインの関数を呼ぶ。例外が出たらコンソールに出して undefined を返す。
 *
 * 戻り値はわざと unknown にしている（Step 6 の再発防止）。Plugin の型は「update は Model を返す」と
 * 書いてあるが、外部プラグインは型の確認を通っていないので、何が返るかわからない。unknown にしておけば、
 * 確かめる関数（looksLikeModel など）を通さないと使えず、確かめ忘れは型エラーになる。
 */
function callPlugin(plugin: Plugin, fn: () => unknown): unknown {
  try {
    return fn();
  } catch (e) {
    console.error(`プラグイン ${plugin.name} でエラーが起きました`, e);
    return undefined;
  }
}
