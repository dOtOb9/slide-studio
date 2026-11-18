import type { Plugin } from '../../plugin-api';
import { reactView } from '../../plugin-api/react';
import { listenPasteAndDrop } from './events';
import { ImagesToolbar } from './ImagesToolbar';
import { updateImages, type ImagesMsg } from './update';

export type { ImagesMsg };

const button = reactView(ImagesToolbar);

const API_WITH_SLIDE_AREA_FOR_DROP_TARGET = '1.4';

export const images: Plugin<ImagesMsg> = {
  name: 'images',
  apiVersion: API_WITH_SLIDE_AREA_FOR_DROP_TARGET,
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
