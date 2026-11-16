// 機能「図形・テキストボックスの挿入」。
// この機能の Msg・update・ツールバー部品をまとめて、registry.ts に登録できる形にする。

import type { Feature } from '../types';
import { ShapesToolbar } from './ShapesToolbar';
import { updateShapes, type ShapesMsg } from './update';

export type { ShapesMsg };

export const shapes: Feature<ShapesMsg> = {
  name: 'shapes',
  update: updateShapes,
  ToolbarSection: ShapesToolbar,
};
