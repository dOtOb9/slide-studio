// React で書いた部品を、プラグインの部品（PluginView: mount / unmount の形）に変える橋渡し。
// 同梱のプラグインは React のまま部品を書き、reactView(部品) を toolbar に渡す。
//
// 部品は store を import せず、props で Model と dispatch を受け取る
// （store → update → host → プラグイン の輪を作らないため。Step 5 の監査の教訓）。

import { useSyncExternalStore, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import type { Model, Msg, PluginContext, PluginView } from './index';

/** React で書いたプラグインの部品が受け取る props */
export interface PluginViewProps {
  model: Model;
  dispatch: (msg: Msg) => void;
}

export function reactView(View: ComponentType<PluginViewProps>): PluginView {
  /** Model が変わるたびに描き直し、部品に Model と dispatch を渡す */
  function Connected({ ctx }: { ctx: PluginContext }) {
    const model = useSyncExternalStore(ctx.subscribe, ctx.getModel);
    return <View model={model} dispatch={ctx.dispatch} />;
  }

  return {
    mount(container, ctx) {
      // container を直接 React の根にせず、中に1つ要素を作ってそこに描く。
      // 開発時（StrictMode）は mount → unmount → mount が続けて起きるので、
      // 前の根を片付け終わる前に、同じ要素へ新しい根を作らないようにするため
      const el = document.createElement('div');
      el.style.display = 'contents'; // 包みの div がツールバーの並びに影響しないように
      container.append(el);
      const root = createRoot(el);
      root.render(<Connected ctx={ctx} />);
      return () => {
        el.remove();
        // アプリ側の React が描画している最中に、別の根を同期的に片付けると React が警告する。
        // 今の処理が終わってから片付ける
        queueMicrotask(() => root.unmount());
      };
    },
  };
}
