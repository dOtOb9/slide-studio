import { describe, expect, it, vi } from 'vitest';
import { initModel, type Model } from '../app/model';
import { update } from '../app/update';
import { parseDeck } from '../model/parse';
import { serializeDeck } from '../model/serialize';
import { api, type PluginContext } from '../plugin-api';
import sample from '../samples/sample-deck.html?raw';
import { pluginFromModule, registerPlugin } from './host';

const untypedJsPathAsStringSoTsSkipsIt: string = '../../examples/sticky-note/plugin.js';
const plugin = registerPlugin(pluginFromModule(await import(/* @vite-ignore */ untypedJsPathAsStringSoTsSkipsIt), api), 'external');

const setup = () => update(initModel(parseDeck(sample), 't.html'), { type: 'SlideSelected', index: 1 });

describe('examples/sticky-note', () => {
  it('付箋を貼り、選択する。貼るたびに色と位置が変わり、1回の Undo で1枚消える', () => {
    const m0 = setup();
    const m1 = update(m0, { type: 'sticky-note/Inserted' });
    const m2 = update(m1, { type: 'sticky-note/Inserted' });
    const els = m2.deck.slides[1].elements;
    const [a, b] = els.slice(-2);
    expect(a).toMatchObject({ id: 'n1', attrs: { 'data-sticky': '' }, rect: { x: 80, y: 80 } });
    expect(b).toMatchObject({ id: 'n2', rect: { x: 120, y: 120 } });
    expect(a.style).not.toBe(b.style);
    expect(m2.selectedId).toBe('n2');
    expect(m2.plugins['sticky-note']).toEqual({ count: 2 });
    expect(update(m2, { type: 'Undo' }).deck).toBe(m1.deck);
  });

  it('保存して読み込み直しても付箋が残る', () => {
    const m = update(setup(), { type: 'sticky-note/Inserted' });
    const reloaded = parseDeck(serializeDeck(m.deck));
    const els = reloaded.slides[1].elements;
    expect(els[els.length - 1]).toMatchObject({ attrs: { 'data-sticky': '' }, html: 'メモ' });
  });

  it('ツールバーの部品: ボタンで Msg を送り、スライドが無ければ押せず、片付けると消える', () => {
    let model: Model = setup();
    const listeners = new Set<() => void>();
    const ctx: PluginContext = {
      getModel: () => model,
      dispatch: vi.fn(),
      subscribe: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      slideArea: () => null,
    };
    const container = document.createElement('div');
    const unmount = plugin.toolbar!.mount(container, ctx);
    const button = container.querySelector('button')!;

    button.click();
    expect(ctx.dispatch).toHaveBeenCalledWith({ type: 'sticky-note/Inserted' });

    model = initModel(parseDeck('<body></body>'), 'e.html');
    listeners.forEach((l) => l());
    expect(button.disabled).toBe(true);

    unmount();
    expect(container.childElementCount).toBe(0);
    expect(listeners.size).toBe(0);
  });
});
