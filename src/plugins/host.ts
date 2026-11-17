import type { Model } from '../app/model';
import type { KeyInput, Msg, PluginMsg } from '../app/msg';
import { API_VERSION, isCompatible, type Plugin, type PluginApi } from '../plugin-api';

export type PluginSource = 'builtin' | 'external';

export type ReceivedPlugin = {
  [K in keyof Plugin]: Plugin[K] extends ((...args: infer A) => unknown) | undefined
    ? ((...args: A) => unknown) | undefined
    : Plugin[K];
};

export interface PluginEntry {
  plugin: ReceivedPlugin;
  source: PluginSource;
  enabled: boolean;
}

let entries: readonly PluginEntry[] = [];
const listeners = new Set<() => void>();

function replaceEntriesWithNewArraySoScreenSeesChange(next: readonly PluginEntry[]) {
  entries = next;
  listeners.forEach((listener) => listener());
}

export function registerPlugin(value: unknown, source: PluginSource): ReceivedPlugin {
  const plugin = validatePlugin(value);
  if (entries.some((e) => e.plugin.name === plugin.name)) {
    throw new Error(`同じ名前のプラグインが既にあります: ${plugin.name}`);
  }
  replaceEntriesWithNewArraySoScreenSeesChange([...entries, { plugin, source, enabled: true }]);
  return plugin;
}

export function unregisterPlugin(name: string) {
  replaceEntriesWithNewArraySoScreenSeesChange(entries.filter((e) => e.plugin.name !== name));
}

export function setPluginEnabled(name: string, enabled: boolean) {
  replaceEntriesWithNewArraySoScreenSeesChange(entries.map((e) => (e.plugin.name === name ? { ...e, enabled } : e)));
}

export function listPlugins(): readonly PluginEntry[] {
  return entries;
}

export function subscribePlugins(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pluginFromModule(mod: unknown, api: PluginApi): unknown {
  const value = (mod as { default?: unknown } | null)?.default;
  if (typeof value === 'function') return value(api);
  if (value) return value;
  throw new Error('プラグインのファイルに export default がありません');
}

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function validatePlugin(value: unknown): ReceivedPlugin {
  if (!value || typeof value !== 'object') throw new Error('プラグインがオブジェクトではありません');
  const p = value as Record<string, unknown>;
  if (typeof p.name !== 'string' || !NAME_PATTERN.test(p.name)) {
    throw new Error(`プラグイン名は英小文字で始まる英小文字・数字・ハイフンにしてください: ${String(p.name)}`);
  }
  if (typeof p.apiVersion !== 'string' || !isCompatible(p.apiVersion)) {
    throw new Error(`プラグイン ${p.name} の apiVersion（${String(p.apiVersion)}）はこのアプリ（${API_VERSION}）で動きません`);
  }
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
  return value as ReceivedPlugin;
}

export function isPluginMsg(msg: Msg): msg is PluginMsg {
  return msg.type.includes('/');
}

export function updatePlugin(model: Model, msg: PluginMsg): Model {
  const name = msg.type.slice(0, msg.type.indexOf('/'));
  const entry = entries.find((e) => e.plugin.name === name);
  const prefixMismatchesPluginNameOrSentAfterUnregister = !entry;
  if (prefixMismatchesPluginNameOrSentAfterUnregister) {
    console.warn(`登録されていないプラグインの Msg: ${msg.type}`);
    return model;
  }
  const { plugin, enabled } = entry;
  if (!enabled || !plugin.update) return model;
  const next = callPlugin(plugin, () => plugin.update!(model, msg));
  if (next === undefined) return model;
  if (!looksLikeModelEnoughForScreenToRead(next)) {
    console.error(`プラグイン ${plugin.name} の update が Model を返しませんでした`);
    return model;
  }
  return next;
}

export const MODEL_KEYS: Record<keyof Model, true> = {
  deck: true,
  fileName: true,
  savedDeck: true,
  nextId: true,
  current: true,
  selectedId: true,
  editingId: true,
  boxes: true,
  gesture: true,
  history: true,
  plugins: true,
  images: true,
  canReadFolder: true,
};

function looksLikeModelEnoughForScreenToRead(value: unknown): value is Model {
  if (!value || typeof value !== 'object') return false;
  if (!Object.keys(MODEL_KEYS).every((key) => key in value)) return false;
  const m = value as Partial<Model>;
  return (
    typeof m.deck === 'object' &&
    m.deck !== null &&
    typeof m.history === 'object' &&
    m.history !== null &&
    typeof m.images === 'object' &&
    m.images !== null
  );
}

export function pluginKey(model: Model, key: KeyInput, update: (model: Model, msg: Msg) => Model): Model | null {
  for (const { plugin, enabled } of entries) {
    if (!enabled || !plugin.onKey) continue;
    const msg = callPlugin(plugin, () => plugin.onKey!(model, key));
    if (msg === null || msg === undefined) continue;
    const coreMsgWouldLoopUpdateAndPluginKeyForever = looksLikeMsg(msg) && !isPluginMsg(msg);
    if (!looksLikeMsg(msg) || coreMsgWouldLoopUpdateAndPluginKeyForever) {
      console.error(`プラグイン ${plugin.name} の onKey がプラグインの Msg ではないものを返しました`, msg);
      continue;
    }
    return update(model, msg);
  }
  return null;
}

export function checkMsgFromPlugin(value: unknown): value is Msg {
  if (looksLikeMsg(value)) return true;
  console.error('プラグインの部品が Msg ではないものを dispatch しました', value);
  return false;
}

export function listenerFromPlugin(value: unknown): (() => void) | null {
  if (typeof value !== 'function') {
    console.error('プラグインの部品が ctx.subscribe に関数ではないものを渡しました', value);
    return null;
  }
  return () => {
    try {
      value();
    } catch (e) {
      console.error('プラグインの部品（ctx.subscribe に渡した関数）でエラーが起きました', e);
    }
  };
}

function looksLikeMsg(value: unknown): value is Msg {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

function callPlugin(plugin: ReceivedPlugin, fn: () => unknown): unknown {
  try {
    return fn();
  } catch (e) {
    console.error(`プラグイン ${plugin.name} でエラーが起きました`, e);
    return undefined;
  }
}
