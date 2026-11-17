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
