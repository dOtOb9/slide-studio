// 同梱のプラグイン（アプリと一緒に配る機能）の一覧。起動時に main.tsx が順に registerPlugin する。
// 新しい同梱プラグインを足すときは ①② に1行ずつ足す。
// 並列で作業して衝突したら、両方の行を残せばよい（並び順がツールバーの並び順になる）。

import type { Plugin } from '../plugin-api';
import { registerPlugin } from './host';

// ① 各プラグインを import する
import { images } from './images/plugin';
import { shapes } from './shapes/plugin';

// ② 一覧に並べる（1行に1つ、末尾に , を付けて足す）
export const builtinPlugins: Plugin[] = [
  shapes,
  images,
];

export function registerBuiltinPlugins() {
  for (const plugin of builtinPlugins) registerPlugin(plugin, 'builtin');
}
