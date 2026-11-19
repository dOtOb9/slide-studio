import { baseCss, dataUriSrc, renderSlideHtml, type ExportInput } from '../../plugin-api';
import playerScript from './player.js?raw';

const PAGE_CSS = `
html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
.screen { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.frame { flex: none; overflow: hidden; }
.slide { transform-origin: 0 0; }
.notes-overlay { position: fixed; left: 0; right: 0; bottom: 0; max-height: 40%; overflow: auto; margin: 0; padding: 16px 24px; background: rgba(0, 0, 0, .8); color: #fff; font: 22px/1.5 system-ui, sans-serif; white-space: pre-wrap; }
.notes-overlay[hidden] { display: none; }
.hint { position: fixed; top: 16px; right: 16px; padding: 8px 12px; border-radius: 6px; background: rgba(255, 255, 255, .14); color: #ddd; font: 14px/1.5 system-ui, sans-serif; pointer-events: none; transition: opacity .6s; }
.hint.gone { opacity: 0; }
`;

const PRESENTER_CSS = `
body { margin: 0; height: 100vh; box-sizing: border-box; padding: 12px; display: grid; grid-template-columns: 3fr 2fr; grid-template-rows: auto 1fr 1fr; gap: 12px; background: #1b1d21; color: #e8e8e8; font: 16px/1.5 system-ui, sans-serif; }
header { grid-column: 1 / 3; display: flex; gap: 24px; font-size: 22px; font-variant-numeric: tabular-nums; }
.box { min-width: 0; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #000; border-radius: 6px; }
.current { grid-row: 2 / 4; }
.frame { flex: none; overflow: hidden; }
.slide { transform-origin: 0 0; }
.notes { overflow: auto; margin: 0; padding: 12px 16px; border-radius: 6px; background: #2a2d33; font-size: 22px; white-space: pre-wrap; }
`;

const HINT = '→・Space・クリックで次へ　F 全画面　P 発表者の画面　N ノート';

const slideHost = (width: number, height: number) => `<div class="slide" style="width:${width}px; height:${height}px"></div>`;

const presenterSlideBox = (part: string, host: string) =>
  `<div class="box ${part}" data-presenter="${part}"><div class="frame">${host}</div></div>`;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function jsonSafeInsideScriptTag(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function titleFrom(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return (dot > 0 ? fileName.slice(0, dot) : fileName) || 'slideshow';
}

export async function slideshowHtml({ deck, images, fileName }: ExportInput): Promise<string> {
  const resolveSrc = await dataUriSrc(images);
  const title = titleFrom(fileName);
  const data = {
    title,
    width: deck.width,
    height: deck.height,
    css: `${baseCss(deck)}\n${deck.css}`,
    slides: deck.slides.map((slide) => ({ html: renderSlideHtml(deck, slide, resolveSrc), notes: slide.notes })),
  };
  const host = slideHost(deck.width, deck.height);
  return [
    '<!doctype html>',
    '<html lang="ja">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${PAGE_CSS}</style>`,
    '</head>',
    '<body>',
    `<main class="screen" data-current="0"><div class="frame">${host}</div></main>`,
    '<pre class="notes-overlay" hidden></pre>',
    `<div class="hint">${escapeHtml(HINT)}</div>`,
    '<template id="presenter-template">',
    `<style>${PRESENTER_CSS}</style>`,
    '<header><span data-presenter="position"></span><span data-presenter="elapsed"></span></header>',
    presenterSlideBox('current', host),
    presenterSlideBox('next', host),
    '<pre class="notes" data-presenter="notes"></pre>',
    '</template>',
    `<script type="application/json" id="slideshow-data">${jsonSafeInsideScriptTag(data)}</script>`,
    `<script>${playerScript}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
