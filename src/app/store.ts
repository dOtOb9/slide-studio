import { create } from 'zustand';
import { parseDeck } from '../model/parse';
import type { PluginContext } from '../plugin-api';
import { checkMsgFromPlugin, listenerFromPlugin } from '../plugins/host';
import sample from '../samples/sample-deck.html?raw';
import { initModel, type Model } from './model';
import type { Msg } from './msg';
import { findSlideArea } from './slideArea';
import { update } from './update';

interface Store {
  model: Model;
  dispatch: (msg: Msg) => void;
}

export const useStore = create<Store>()((set, get) => ({
  model: initModel(parseDeck(sample), 'sample-deck.html'),
  dispatch: (msg) => {
    const prev = get().model;
    const next = update(prev, msg);
    if (next !== prev) set({ model: next });
  },
}));

export const useModel = <T>(select: (model: Model) => T): T => useStore((s) => select(s.model));

export const useDispatch = () => useStore((s) => s.dispatch);

export const getModel = () => useStore.getState().model;

export const pluginContext: PluginContext = {
  getModel,
  dispatch: (msg: unknown) => {
    if (checkMsgFromPlugin(msg)) useStore.getState().dispatch(msg);
  },
  subscribe: (listener: unknown) => {
    const safe = listenerFromPlugin(listener);
    if (!safe) return () => {};
    return useStore.subscribe(() => safe());
  },
  slideArea: findSlideArea,
};
