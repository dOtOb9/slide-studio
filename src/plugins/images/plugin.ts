import type { Plugin } from '../../plugin-api';
import { reactView } from '../../plugin-api/react';
import { listenPasteAndDrop } from './events';
import { ImagesToolbar } from './ImagesToolbar';
import { updateImages, type ImagesMsg } from './update';

export type { ImagesMsg };

const button = reactView(ImagesToolbar);

const API_WITH_CHECK_IMAGE_FILE_AND_EXTENSION_OF = '1.3';

export const images: Plugin<ImagesMsg> = {
  name: 'images',
  apiVersion: API_WITH_CHECK_IMAGE_FILE_AND_EXTENSION_OF,
  title: '画像',
  description: '画像を挿入する（ボタンでファイルを選ぶ・貼り付け・キャンバスへのドラッグ&ドロップ）',
  update: updateImages,
  toolbar: {
    mount(container, ctx) {
      const unmountButton = button.mount(container, ctx);
      const stopListeningWhenDisabledOrRemoved = listenPasteAndDrop(ctx);
      return () => {
        stopListeningWhenDisabledOrRemoved();
        unmountButton();
      };
    },
  },
};
