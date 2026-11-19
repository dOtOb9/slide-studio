import type { Plugin } from '../plugin-api';
import { registerPlugin } from './host';

import { images } from './images/plugin';
import { shapes } from './shapes/plugin';
import { slideshow } from './slideshow/plugin';

export const builtinPlugins: Plugin[] = [
  shapes,
  images,
  slideshow,
];

export function registerBuiltinPlugins() {
  for (const plugin of builtinPlugins) registerPlugin(plugin, 'builtin');
}
