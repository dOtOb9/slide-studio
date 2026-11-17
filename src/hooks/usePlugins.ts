import { useSyncExternalStore } from 'react';
import { listPlugins, subscribePlugins } from '../plugins/host';

export function usePlugins() {
  return useSyncExternalStore(subscribePlugins, listPlugins);
}
