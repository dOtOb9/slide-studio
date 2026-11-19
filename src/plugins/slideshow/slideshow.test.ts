import { slideshow } from './plugin';

import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDeck } from '../../model/parse';
import { dataUriSrc, renderSlideHtml, type Deck } from '../../plugin-api';
import sample from '../../samples/sample-deck.html?raw';
import { exportersOf, listPlugins, registerPlugin, runExporter } from '../host';

registerPlugin(slideshow, 'builtin');

const PNG = `images/${'a'.repeat(64)}.png`;
const SVG = `images/${'b'.repeat(64)}.svg`;
const pngBlob = new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: 'image/png' });
const svgBlob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="red"/></svg>'], {
  type: 'image/svg+xml',
});

const deckWithImages = (): Deck => {
  const deck = parseDeck(sample);
  const withImages = parseDeck(`<body><section data-layout="blank">
    <img data-el src="${PNG}" style="left:10px; top:20px; width:300px; height:200px">
    <img data-el src="${SVG}" style="left:400px; top:20px; width:300px; height:200px">
    <aside data-notes>画像のスライドのノート
2行目 &lt;/script&gt; &amp; &lt;b&gt;</aside>
  </section></body>`);
  return { ...deck, slides: [...deck.slides, ...withImages.slides] };
};

const images = { [PNG]: pngBlob, [SVG]: svgBlob };
const IMAGE_SLIDE_AFTER_FOUR_SAMPLE_SLIDES = 4;

const exporter = () => exportersOf(listPlugins()).find((e) => e.pluginName === 'slideshow')!;

const exportHtml = async (deck = deckWithImages(), fileName = 'talk.html') =>
  (await runExporter(exporter(), { deck, images, fileName })).text();

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

interface SlideshowData {
  title: string;
  width: number;
  height: number;
  css: string;
  slides: { html: string; notes: string }[];
}

const dataOf = (doc: Document): SlideshowData => JSON.parse(doc.querySelector('script[type="application/json"]')!.textContent!);
const playerScriptOf = (doc: Document) => doc.querySelector('script:not([type])')!.textContent!;

function commentsInScript(text: string): string[] {
  const source = ts.createSourceFile('player.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const found = new Set<string>();
  const visit = (node: ts.Node) => {
    for (const r of ts.getLeadingCommentRanges(text, node.pos) ?? []) found.add(text.slice(r.pos, r.end));
    for (const r of ts.getTrailingCommentRanges(text, node.end) ?? []) found.add(text.slice(r.pos, r.end));
    node.getChildren(source).forEach(visit);
  };
  visit(source);
  return [...found];
}

describe('登録', () => {
  it('書き出しの形式「発表用 HTML」を登録している', () => {
    expect(exporter().exporter).toMatchObject({ id: 'slideshow', extension: 'html', mimeType: 'text/html' });
    expect(exporter().exporter.icon).toMatch(/^<svg/);
  });
});

describe('書き出した発表用 HTML', () => {
  it('Blob の型は text/html', async () => {
    const blob = await runExporter(exporter(), { deck: deckWithImages(), images, fileName: 'talk.html' });
    expect(blob.type).toBe('text/html');
  });

  it('外のファイルやネットワークを参照しない（link・外部の script・src や href・CSS の url() と @import が data: 以外を指さない）', async () => {
    const html = await exportHtml();
    const doc = parse(html);
    expect(doc.querySelectorAll('link, script[src], iframe, object, embed')).toHaveLength(0);
    const slidesHtml = dataOf(doc).slides.map((s) => s.html).join('');
    const dataScript = doc.querySelector('script[type="application/json"]')!.textContent!;
    const everything = html.replace(dataScript, '') + slidesHtml + dataOf(doc).css;
    const references = [...everything.matchAll(/\b(?:src|href)\s*=\s*["']?([^"'\s>]*)/gi)].map((m) => m[1]);
    expect(references.length).toBeGreaterThan(0);
    expect(references.filter((ref) => !ref.startsWith('data:'))).toEqual([]);
    expect([...everything.matchAll(/url\(\s*["']?([^"')]*)/gi)].map((m) => m[1]).filter((ref) => !ref.startsWith('data:'))).toEqual([]);
    expect(everything).not.toMatch(/@import/i);
  });

  it('images/ の画像を data URI で埋め込み、images/ のパスは残さない', async () => {
    const html = await exportHtml();
    const slide = parse(dataOf(parse(html)).slides[IMAGE_SLIDE_AFTER_FOUR_SAMPLE_SLIDES].html);
    const srcs = [...slide.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(srcs).toEqual([`data:image/png;base64,${btoa(String.fromCharCode(137, 80, 78, 71, 1, 2, 3))}`, expect.stringMatching(/^data:image\/svg\+xml;base64,/)]);
    expect(html).not.toContain('images/');
  });

  it('すべてのスライドとノートが順に入っている', async () => {
    const deck = deckWithImages();
    const data = dataOf(parse(await exportHtml(deck)));
    expect(data.slides).toHaveLength(deck.slides.length);
    expect(data.slides.map((s) => s.notes)).toEqual(deck.slides.map((s) => s.notes));
    expect(data.slides[IMAGE_SLIDE_AFTER_FOUR_SAMPLE_SLIDES].notes).toContain('</script> & <b>');
    expect(data).toMatchObject({ width: 1920, height: 1080, title: 'talk' });
  });

  it('スライドの見た目は編集画面と同じ描画（renderSlideHtml に data URI の src）で、テーマ CSS も入る', async () => {
    const deck = deckWithImages();
    const data = dataOf(parse(await exportHtml(deck)));
    const resolve = await dataUriSrc(images);
    expect(data.slides.map((s) => s.html)).toEqual(deck.slides.map((s) => renderSlideHtml(deck, s, resolve)));
    expect(data.css).toContain(deck.css);
  });

  it('ノートやスライドに </script> があっても、データの script が途中で閉じない', async () => {
    const html = await exportHtml();
    const doc = parse(html);
    expect(doc.querySelectorAll('script')).toHaveLength(2);
    expect(dataOf(doc).slides[IMAGE_SLIDE_AFTER_FOUR_SAMPLE_SLIDES].notes).toBe('画像のスライドのノート\n2行目 </script> & <b>');
  });

  it('タイトルはファイル名から拡張子を外したもので、HTML として安全に入る', async () => {
    const doc = parse(await exportHtml(deckWithImages(), 'a<b>&c.html'));
    expect(doc.title).toBe('a<b>&c');
  });

  it('生成物（JS・CSS・HTML）にコメントを入れない', async () => {
    const html = await exportHtml();
    const doc = parse(html);
    expect(commentsInScript(playerScriptOf(doc))).toEqual([]);
    expect(html).not.toMatch(/<!--/);
    expect([...doc.querySelectorAll('style')].map((s) => s.textContent).join('')).not.toMatch(/\/\*/);
    expect(doc.querySelector('template')!.innerHTML).not.toMatch(/\/\*|<!--/);
  });

  it('表示用の JS は構文として正しい', async () => {
    const script = playerScriptOf(parse(await exportHtml()));
    expect(() => new Function(script)).not.toThrow();
  });
});

const jsdomModuleNameAsStringSinceTypesAreNotInstalled: string = 'jsdom';
interface DomWindow extends Window {
  close(): void;
}
type JsdomCtor = new (html: string, options?: { runScripts?: 'dangerously'; beforeParse?: (window: DomWindow) => void }) => {
  window: DomWindow;
};
const { JSDOM } = (await import(/* @vite-ignore */ jsdomModuleNameAsStringSinceTypesAreNotInstalled)) as { JSDOM: JsdomCtor };

const openedWindows: DomWindow[] = [];
afterEach(() => {
  openedWindows.splice(0).forEach((w) => w.close());
});

interface Player {
  window: DomWindow;
  popup: DomWindow | null;
  key(key: string, target?: DomWindow): void;
  current(): number;
  shownSlideTitle(): string | undefined;
}

async function play({ popupBlocked = false, screen = { width: 960, height: 800 } } = {}): Promise<Player> {
  const html = await exportHtml();
  const popup = popupBlocked ? null : new JSDOM('<!doctype html><html><head></head><body></body></html>').window;
  if (popup) openedWindows.push(popup);
  const { window } = new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(w) {
      Object.assign(w, { open: () => popup });
      Object.defineProperty((w as unknown as typeof globalThis).HTMLElement.prototype, 'clientWidth', {
        get(this: HTMLElement) {
          return this.classList.contains('screen') ? screen.width : 0;
        },
      });
      Object.defineProperty((w as unknown as typeof globalThis).HTMLElement.prototype, 'clientHeight', {
        get(this: HTMLElement) {
          return this.classList.contains('screen') ? screen.height : 0;
        },
      });
    },
  });
  openedWindows.push(window);
  const doc = window.document;
  return {
    window,
    popup,
    key(key, target = window) {
      target.document.dispatchEvent(new (target as unknown as typeof globalThis).KeyboardEvent('keydown', { key, bubbles: true }));
    },
    current: () => Number(doc.querySelector<HTMLElement>('.screen')!.dataset.current),
    shownSlideTitle: () => doc.querySelector('.screen .slide')!.shadowRoot?.querySelector('[data-ph="title"]')?.textContent ?? undefined,
  };
}

describe('発表用 HTML の表示（JS）', () => {
  it('開くと1枚目を、テーマ CSS 付きの Shadow DOM に描く', async () => {
    const p = await play();
    expect(p.current()).toBe(0);
    expect(p.shownSlideTitle()).toBe('Slide Studio');
    const root = p.window.document.querySelector('.screen .slide')!.shadowRoot!;
    expect(root.querySelector('style')!.textContent).toContain('[data-ph="title"]');
  });

  it.each(['ArrowRight', 'ArrowDown', ' ', 'PageDown'])('%s で次へ', async (key) => {
    const p = await play();
    p.key(key);
    expect(p.current()).toBe(1);
    expect(p.shownSlideTitle()).toBe('このファイルの仕組み');
  });

  it.each(['ArrowLeft', 'ArrowUp', 'PageUp'])('%s で前へ', async (key) => {
    const p = await play();
    p.key('End');
    p.key(key);
    expect(p.current()).toBe(3);
  });

  it('クリックで次へ。Home / End で最初 / 最後へ。端より先へは行かない', async () => {
    const p = await play();
    p.window.document.querySelector<HTMLElement>('.screen')!.click();
    expect(p.current()).toBe(1);
    p.key('End');
    expect(p.current()).toBe(4);
    p.key('ArrowRight');
    expect(p.current()).toBe(4);
    p.key('Home');
    expect(p.current()).toBe(0);
    p.key('ArrowLeft');
    expect(p.current()).toBe(0);
  });

  it('画面の大きさに合わせて縦横比を保って拡大縮小し、大きさが変わると合わせ直す', async () => {
    const screen = { width: 960, height: 800 };
    const p = await play({ screen });
    const slide = p.window.document.querySelector<HTMLElement>('.screen .slide')!;
    const frame = p.window.document.querySelector<HTMLElement>('.screen .frame')!;
    expect(slide.style.transform).toBe('scale(0.5)');
    expect([frame.style.width, frame.style.height]).toEqual(['960px', '540px']);
    screen.width = 3000;
    screen.height = 540;
    p.window.dispatchEvent(new (p.window as unknown as typeof globalThis).Event('resize'));
    expect(slide.style.transform).toBe('scale(0.5)');
    screen.height = 1620;
    p.window.dispatchEvent(new (p.window as unknown as typeof globalThis).Event('resize'));
    expect(slide.style.transform).toBe('scale(1.5)');
    expect([frame.style.width, frame.style.height]).toEqual(['2880px', '1620px']);
  });

  it('P で発表者の画面（別ウィンドウ）を開き、今のスライド・次のスライド・ノート・位置・経過時間を出す', async () => {
    const p = await play();
    p.key('ArrowRight');
    p.key('p');
    const doc = p.popup!.document;
    const part = (name: string) => doc.querySelector<HTMLElement>(`[data-presenter="${name}"]`)!;
    expect(part('notes').textContent).toBe('発表者ノートは <aside data-notes> に書く。スライドには表示されない。');
    expect(part('position').textContent).toBe('2 / 5');
    expect(part('elapsed').textContent).toBe('00:00');
    const titleIn = (name: string) => part(name).querySelector('.slide')!.shadowRoot!.querySelector('[data-ph="title"]')?.textContent;
    expect(titleIn('current')).toBe('このファイルの仕組み');
    expect(titleIn('next')).toBe('位置の上書きと自由配置');
  });

  it('発表者の画面は元の画面と同期する（どちらで送っても両方が変わる）', async () => {
    const p = await play();
    p.key('p');
    const doc = p.popup!.document;
    const position = () => doc.querySelector('[data-presenter="position"]')!.textContent;
    p.key('ArrowRight');
    expect(position()).toBe('2 / 5');
    p.key('ArrowRight', p.popup!);
    expect(p.current()).toBe(2);
    expect(position()).toBe('3 / 5');
    p.key('End', p.popup!);
    expect(p.current()).toBe(4);
    expect(doc.querySelector('[data-presenter="notes"]')!.textContent).toBe('画像のスライドのノート\n2行目 </script> & <b>');
    expect(doc.querySelector('[data-presenter="next"] .slide')!.shadowRoot?.innerHTML ?? '').toBe('');
  });

  it('別ウィンドウを開けない（ポップアップを止められた）ときは、ノートを元の画面に重ねて出す', async () => {
    const p = await play({ popupBlocked: true });
    const overlay = p.window.document.querySelector<HTMLElement>('.notes-overlay')!;
    expect(overlay.hidden).toBe(true);
    p.key('p');
    expect(overlay.hidden).toBe(false);
  });

  it('N でノートの重ね表示を切り替え、送るとノートも変わる', async () => {
    const p = await play();
    const overlay = p.window.document.querySelector<HTMLElement>('.notes-overlay')!;
    p.key('n');
    expect(overlay.hidden).toBe(false);
    p.key('ArrowRight');
    expect(overlay.textContent).toBe('発表者ノートは <aside data-notes> に書く。スライドには表示されない。');
    p.key('n');
    expect(overlay.hidden).toBe(true);
  });

  it('Ctrl などを押しながらのキーは横取りしない（ブラウザの操作を邪魔しない）', async () => {
    const p = await play();
    p.window.document.dispatchEvent(
      new (p.window as unknown as typeof globalThis).KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true }),
    );
    expect(p.current()).toBe(0);
  });
});
