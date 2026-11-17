// 貼り付け（paste）とドロップ（drop）を受ける部品の側の処理（Elm でいう Sub）。
// ページ全体（window）のイベントなので、部品の mount で登録し、unmount で必ず外す（listenPasteAndDrop の戻り値）。
// プラグインの一覧で無効にすると部品が unmount されるので、そのときは反応しなくなる。

import type { PluginContext } from '../../plugin-api';
import { insertImageFiles } from './prepare';
import { canInsertImages } from './update';

/** DataTransfer（クリップボード・ドロップ）の中のファイル。ファイルが無ければ空 */
export function filesOf(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];
  if (data.files && data.files.length > 0) return Array.from(data.files);
  // ブラウザによっては files が空で items にだけファイルが入る
  return Array.from(data.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

/** ドラッグしているものがファイルか（テキストやリンクのドラッグは対象外） */
export function isFileDrag(data: DataTransfer | null | undefined): boolean {
  return !!data && Array.from(data.types ?? []).includes('Files');
}

/** 文字を入力する場所か（入力欄・contentEditable）。そこへの貼り付けはブラウザに任せる */
export function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

/**
 * ドロップを受け付ける場所: 中央の作業領域（土台の <main class="stage">。キャンバスとその周りの余白）。
 * 土台のクラス名に頼っている（plugin-api の約束ではない）。名前が変わるとドロップだけが効かなくなる
 */
const DROP_AREA = '.stage';

function dropAreaOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(DROP_AREA) : null;
}

/**
 * 貼り付けとドロップの受け付けを始める。戻り値を呼ぶと、登録したイベントと表示を片付ける。
 * insert は差し替え用（テスト）。ふつうは insertImageFiles
 */
export function listenPasteAndDrop(
  ctx: PluginContext,
  insert: (files: File[], dispatch: PluginContext['dispatch']) => Promise<void> = insertImageFiles,
): () => void {
  const onPaste = (e: ClipboardEvent) => {
    // テキスト編集中・入力欄への貼り付けは、文字の貼り付けとしてブラウザに任せる
    if (ctx.getModel().editingId !== null || isTextTarget(e.target)) return;
    const files = filesOf(e.clipboardData);
    // 画像が無ければ何もしない（ほかの貼り付けを邪魔しない）。画像があれば、混ざっている画像でないファイルは理由を出して断る
    if (!files.some((f) => f.type.startsWith('image/'))) return;
    if (!canInsertImages(ctx.getModel())) return;
    e.preventDefault();
    void insert(files, ctx.dispatch);
  };

  // ドロップできる場所の上にいる間、その場所に色を重ねて「ここに落とせる」を示す（線でなく色差。style.css）
  const highlight = document.createElement('div');
  highlight.className = 'images-drop-highlight';
  highlight.hidden = true;
  document.body.append(highlight);
  const showOver = (area: HTMLElement | null) => {
    if (!area) {
      highlight.hidden = true;
      return;
    }
    const r = area.getBoundingClientRect();
    Object.assign(highlight.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    highlight.hidden = false;
  };

  const onDragOver = (e: DragEvent) => {
    if (!isFileDrag(e.dataTransfer)) return; // テキストなどのドラッグは邪魔しない
    // ファイルのドラッグは、どこでも既定の動作を止める（止めないと、外れた場所に落としたときブラウザがファイルを開いてしまう）
    e.preventDefault();
    const area = canInsertImages(ctx.getModel()) ? dropAreaOf(e.target) : null;
    if (e.dataTransfer) e.dataTransfer.dropEffect = area ? 'copy' : 'none';
    showOver(area);
  };
  const onDragLeave = (e: DragEvent) => {
    // 作業領域の外（またはウィンドウの外）へ出たら消す。中の要素どうしの移動では消さない
    if (!dropAreaOf(e.relatedTarget)) showOver(null);
  };
  const onDrop = (e: DragEvent) => {
    showOver(null);
    if (!isFileDrag(e.dataTransfer)) return;
    e.preventDefault();
    if (!dropAreaOf(e.target) || !canInsertImages(ctx.getModel())) return;
    void insert(filesOf(e.dataTransfer), ctx.dispatch);
  };
  const onDragEnd = () => showOver(null);

  window.addEventListener('paste', onPaste);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);
  window.addEventListener('dragend', onDragEnd);
  return () => {
    window.removeEventListener('paste', onPaste);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('dragleave', onDragLeave);
    window.removeEventListener('drop', onDrop);
    window.removeEventListener('dragend', onDragEnd);
    highlight.remove();
  };
}
