import { useEffect, useRef } from 'react';
import { pluginContext } from '../app/store';
import type { PluginView } from '../plugin-api';

function clearLeftoverDomSoNextMountIsNotDoubled(container: HTMLElement) {
  container.replaceChildren();
}

export function PluginSlot({ name, view }: { name: string; view: PluginView }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let unmount: unknown;
    try {
      unmount = view.mount(container, pluginContext);
    } catch (e) {
      console.error(`プラグイン ${name} の部品を表示できませんでした`, e);
    }
    return () => {
      try {
        if (typeof unmount === 'function') unmount();
      } catch (e) {
        console.error(`プラグイン ${name} の部品を片付けられませんでした`, e);
      }
      clearLeftoverDomSoNextMountIsNotDoubled(container);
    };
  }, [name, view]);

  return <div className="group" ref={ref} data-plugin={name} />;
}
