// プラグインの部品を置く場所（view）。
// 部品は React に依存しない mount(container, ctx) => unmount の形なので、
// ここで空の div を用意して mount に渡し、消えるときに unmount を呼ぶ。

import { useEffect, useRef } from 'react';
import { pluginContext } from '../app/store';
import type { PluginView } from '../plugin-api';

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
      // 片付け忘れた DOM が残っていても、次に mount したときに二重にならないよう空にする
      container.replaceChildren();
    };
  }, [name, view]);

  return <div className="group" ref={ref} data-plugin={name} />;
}
