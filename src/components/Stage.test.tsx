import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { pluginContext } from '../app/store';
import { Stage } from './Stage';

class ResizeObserverThatNeverFiresSinceJsdomHasNoLayout {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it('Stage（作業領域）が、プラグインの ctx.slideArea() が返す要素になる', async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverThatNeverFiresSinceJsdomHasNoLayout);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Stage />));
  const stage = container.querySelector('main');
  expect(stage).not.toBeNull();
  expect(pluginContext.slideArea()).toBe(stage);
  act(() => root.unmount());
  expect(pluginContext.slideArea()).toBeNull();
});
