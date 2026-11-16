// プラグインの登録簿（plugins/host.ts）を React から読む。
// 登録簿は store の外にあるので、useSyncExternalStore で「変わったら描き直す」ようにつなぐ。

import { useSyncExternalStore } from 'react';
import { listPlugins, subscribePlugins } from '../plugins/host';

export function usePlugins() {
  return useSyncExternalStore(subscribePlugins, listPlugins);
}
