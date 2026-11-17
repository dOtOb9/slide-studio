// 同梱プラグイン「画像の挿入」。plugins/builtin.ts に登録する。
// 純粋な部分（update.ts・layout.ts）と、ファイルを受け取る部品（ImagesToolbar.tsx・prepare.ts）を1つの Plugin にまとめる。

import type { Plugin } from '../../plugin-api';
import { reactView } from '../../plugin-api/react';
import { ImagesToolbar } from './ImagesToolbar';
import { updateImages, type ImagesMsg } from './update';

export type { ImagesMsg };

export const images: Plugin<ImagesMsg> = {
  name: 'images',
  apiVersion: '1.3', // checkImageFile / extensionOf を使う
  title: '画像',
  description: '画像を挿入する（ボタンでファイルを選ぶ・貼り付け・キャンバスへのドラッグ&ドロップ）',
  update: updateImages,
  toolbar: reactView(ImagesToolbar),
};
