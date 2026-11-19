import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../app/store';
import type { Exporter } from '../plugin-api';
import { listPlugins, registerPlugin, setPluginEnabled, unregisterPlugin } from '../plugins/host';
import { ExportButtons } from './ExportButtons';

const ICON = '<svg viewBox="0 0 24 24" data-test-icon><path d="M2 3h20"/></svg>';
const countExporter: Exporter = {
  id: 'count',
  title: '枚数',
  extension: 'txt',
  mimeType: 'text/plain',
  icon: ICON,
  export: ({ deck, fileName }) => new Blob([`${fileName}:${deck.slides.length}`], { type: 'text/plain' }),
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  for (const { plugin } of listPlugins()) unregisterPlugin(plugin.name);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const render = () => act(async () => root.render(<ExportButtons />));
const buttons = () => [...container.querySelectorAll('button')];

describe('ExportButtons（ツールバーの書き出しのボタン）', () => {
  it('書き出しの形式ごとにアイコンのボタンを出し、説明はツールチップに書く。icon が無ければ既定のアイコン', async () => {
    registerPlugin({ name: 'exp', apiVersion: '1.5', exporters: [countExporter, { ...countExporter, id: 'plain', title: '素の', icon: undefined }] }, 'external');
    await render();
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual(['書き出し: 枚数 (.txt)', '書き出し: 素の (.txt)']);
    expect(buttons()[0].title).toBe('書き出し: 枚数 (.txt)');
    expect(buttons()[0].querySelector('svg[data-test-icon]')).not.toBeNull();
    expect(buttons()[1].querySelector('svg')).not.toBeNull();
  });

  it('プラグインを無効にするとボタンが消え、書き出しの形式が無ければ何も出さない', async () => {
    registerPlugin({ name: 'exp', apiVersion: '1.5', exporters: [countExporter] }, 'external');
    await render();
    expect(buttons()).toHaveLength(1);
    await act(async () => setPluginEnabled('exp', false));
    expect(buttons()).toHaveLength(0);
  });

  it('押すと保存先を選ばせ（候補の名前と種類つき）、選んだファイルにプラグインの作った Blob を書く', async () => {
    const written: unknown[] = [];
    const showSaveFilePicker = vi.fn(async () => ({
      kind: 'file',
      name: 'chosen.txt',
      createWritable: async () => ({ write: async (data: unknown) => void written.push(data), close: async () => {} }),
    }));
    vi.stubGlobal('showSaveFilePicker', showSaveFilePicker);
    registerPlugin({ name: 'exp', apiVersion: '1.5', exporters: [countExporter] }, 'external');
    await render();
    await act(async () => buttons()[0].click());
    await vi.waitFor(() => expect(written).toHaveLength(1));
    const { fileName, deck } = useStore.getState().model;
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: 'sample-deck-count.txt',
      types: [{ description: '枚数', accept: { 'text/plain': ['.txt'] } }],
    });
    expect(await (written[0] as Blob).text()).toBe(`${fileName}:${deck.slides.length}`);
  });

  it('ファイルシステムアクセス API が無ければダウンロードで書き出す', async () => {
    vi.stubGlobal('showSaveFilePicker', undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    registerPlugin({ name: 'exp', apiVersion: '1.5', exporters: [countExporter] }, 'external');
    await render();
    await act(async () => buttons()[0].click());
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('sample-deck-count.txt');
  });

  it('プラグインの export が Blob を返さなければ、何も書かずに理由を知らせる', async () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const write = vi.fn();
    vi.stubGlobal('showSaveFilePicker', async () => ({ kind: 'file', name: 'x.txt', createWritable: async () => ({ write, close: async () => {} }) }));
    registerPlugin({ name: 'bad', apiVersion: '1.5', exporters: [{ ...countExporter, export: () => 'text' }] }, 'external');
    await render();
    await act(async () => buttons()[0].click());
    await vi.waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][0]).toContain('Blob を返しませんでした');
    expect(write).not.toHaveBeenCalled();
  });
});
