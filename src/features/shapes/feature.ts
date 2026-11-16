// 機能「図形・テキストボックスの挿入」の純粋な部分。features/registry.ts に登録する。

import type { Feature } from '../types';
import { updateShapes, type ShapesMsg } from './update';

export type { ShapesMsg };

export const shapes: Feature<ShapesMsg> = {
  name: 'shapes',
  update: updateShapes,
};
