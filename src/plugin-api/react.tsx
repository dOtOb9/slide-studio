import { useSyncExternalStore, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Model, Msg, PluginContext, PluginView } from './index';

export interface PluginViewProps {
  model: Model;
  dispatch: (msg: Msg) => void;
}

function freshRootElementSoStrictModeRemountNeverReusesOne(container: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  const doesNotAffectToolbarLayout = 'contents';
  el.style.display = doesNotAffectToolbarLayout;
  container.append(el);
  return el;
}

function unmountAfterAppReactFinishesRenderingToAvoidWarning(root: Root) {
  queueMicrotask(() => root.unmount());
}

export function reactView(View: ComponentType<PluginViewProps>): PluginView {
  function Connected({ ctx }: { ctx: PluginContext }) {
    const model = useSyncExternalStore(ctx.subscribe, ctx.getModel);
    return <View model={model} dispatch={ctx.dispatch} />;
  }

  return {
    mount(container, ctx) {
      const el = freshRootElementSoStrictModeRemountNeverReusesOne(container);
      const root = createRoot(el);
      root.render(<Connected ctx={ctx} />);
      return () => {
        el.remove();
        unmountAfterAppReactFinishesRenderingToAvoidWarning(root);
      };
    },
  };
}
