import type { Plugin } from '../plugin-api';
import { registerPlugin } from './host';

import { images } from './images/plugin';
import { shapes } from './shapes/plugin';

export const builtinPlugins: Plugin[] = [
  shapes,
  images,
];

export function registerBuiltinPlugins() {
  for (const plugin of builtinPlugins) registerPlugin(plugin, 'builtin');
}
