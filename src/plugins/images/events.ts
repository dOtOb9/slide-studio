import type { PluginContext } from '../../plugin-api';
import { insertImageFiles } from './prepare';
import { canInsertImages } from './update';

export function filesOf(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];
  if (data.files && data.files.length > 0) return Array.from(data.files);
  return filesFromItemsForBrowsersThatLeaveFilesEmpty(data);
}

function filesFromItemsForBrowsersThatLeaveFilesEmpty(data: DataTransfer): File[] {
  return Array.from(data.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

export function isFileDrag(data: DataTransfer | null | undefined): boolean {
  return !!data && Array.from(data.types ?? []).includes('Files');
}

export function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

const BASE_STAGE_CLASS_NOT_PROMISED_BY_PLUGIN_API = '.stage';

function keepBrowserFromOpeningFileDroppedAnywhere(e: DragEvent) {
  e.preventDefault();
}

function dropAreaOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(BASE_STAGE_CLASS_NOT_PROMISED_BY_PLUGIN_API) : null;
}

export function listenPasteAndDrop(
  ctx: PluginContext,
  insert: (files: File[], dispatch: PluginContext['dispatch']) => Promise<void> = insertImageFiles,
): () => void {
  const onPaste = (e: ClipboardEvent) => {
    const leaveTextPasteToBrowser = ctx.getModel().editingId !== null || isTextTarget(e.target);
    if (leaveTextPasteToBrowser) return;
    const files = filesOf(e.clipboardData);
    const noImageSoDoNotHijackOtherPastes = !files.some((f) => f.type.startsWith('image/'));
    if (noImageSoDoNotHijackOtherPastes) return;
    if (!canInsertImages(ctx.getModel())) return;
    e.preventDefault();
    void insert(files, ctx.dispatch);
  };

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
    const leaveTextOrLinkDragsAlone = !isFileDrag(e.dataTransfer);
    if (leaveTextOrLinkDragsAlone) return;
    keepBrowserFromOpeningFileDroppedAnywhere(e);
    const area = canInsertImages(ctx.getModel()) ? dropAreaOf(e.target) : null;
    if (e.dataTransfer) e.dataTransfer.dropEffect = area ? 'copy' : 'none';
    showOver(area);
  };
  const onDragLeave = (e: DragEvent) => {
    const leftAreaOrWindowNotJustMovedBetweenChildren = !dropAreaOf(e.relatedTarget);
    if (leftAreaOrWindowNotJustMovedBetweenChildren) showOver(null);
  };
  const onDrop = (e: DragEvent) => {
    showOver(null);
    if (!isFileDrag(e.dataTransfer)) return;
    keepBrowserFromOpeningFileDroppedAnywhere(e);
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
