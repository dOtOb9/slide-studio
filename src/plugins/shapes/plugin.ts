// 同梱プラグイン「図形・テキストボックスの挿入」。plugins/builtin.ts に登録する。
// プラグインの手本: 純粋な部分（update.ts）と部品（ShapesToolbar.tsx）を1つの Plugin にまとめる。

import type { Plugin } from '../../plugin-api';
import { reactView } from '../../plugin-api/react';
import { ShapesToolbar } from './ShapesToolbar';
import { updateShapes, type ShapesMsg } from './update';

export type { ShapesMsg };

export const shapes: Plugin<ShapesMsg> = {
  name: 'shapes',
  apiVersion: '1.0',
  title: '図形',
  description: 'テキストボックス・四角・円・矢印を挿入する',
  update: updateShapes,
  toolbar: reactView(ShapesToolbar),
};
