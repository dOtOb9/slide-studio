// 同梱プラグイン「画像の挿入」。plugins/builtin.ts に登録する。
// 純粋な部分（update.ts・layout.ts）と、ファイルを受け取る部品（ImagesToolbar.tsx・events.ts・prepare.ts）を1つの Plugin にまとめる。

import type { Plugin } from '../../plugin-api';
import { reactView } from '../../plugin-api/react';
import { listenPasteAndDrop } from './events';
import { ImagesToolbar } from './ImagesToolbar';
import { updateImages, type ImagesMsg } from './update';

export type { ImagesMsg };

const button = reactView(ImagesToolbar);

export const images: Plugin<ImagesMsg> = {
  name: 'images',
  apiVersion: '1.3', // checkImageFile / extensionOf を使う
  title: '画像',
  description: '画像を挿入する（ボタンでファイルを選ぶ・貼り付け・キャンバスへのドラッグ&ドロップ）',
  update: updateImages,
  toolbar: {
    // ツールバーのボタンに加えて、貼り付け・ドロップの受け付けもここで始める。
    // 部品が外れる（プラグインを無効にした・取り外した）ときに、両方を必ず片付ける
    mount(container, ctx) {
      const unmountButton = button.mount(container, ctx);
      const stopListening = listenPasteAndDrop(ctx);
      return () => {
        stopListening();
        unmountButton();
      };
    },
  },
};
