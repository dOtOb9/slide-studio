import type { Plugin } from '../../plugin-api';
import { slideshowHtml } from './slideshow';

const LUCIDE_PRESENTATION_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></svg>';

const API_WITH_EXPORTERS = '1.5';

export const slideshow: Plugin = {
  name: 'slideshow',
  apiVersion: API_WITH_EXPORTERS,
  title: '発表用 HTML',
  description: '他の PC でも開ける、1ファイルの発表用 HTML（画像を埋め込み、キー・クリックで送る。発表者の画面つき）を書き出す',
  exporters: [
    {
      id: 'slideshow',
      title: '発表用 HTML',
      extension: 'html',
      mimeType: 'text/html',
      icon: LUCIDE_PRESENTATION_ICON,
      export: async (input) => new Blob([await slideshowHtml(input)], { type: 'text/html' }),
    },
  ],
};
