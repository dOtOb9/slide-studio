// Model を保持して Msg を受け付ける、薄い箱（Elm でいうランタイム）。
// ロジックは持たない。dispatch(msg) が来たら update に渡し、結果を次の Model にするだけ。
//
// コンポーネントからの使い方:
//   const deck = useModel((m) => m.deck);   // Model の一部を読む（変わったときだけ再描画される）
//   const dispatch = useDispatch();         // Msg を送る
//   dispatch({ type: 'Undo' });

import { create } from 'zustand';
import { parseDeck } from '../model/parse';
import type { PluginContext } from '../plugin-api';
import { checkMsgFromPlugin, listenerFromPlugin } from '../plugins/host';
import sample from '../samples/sample-deck.html?raw';
import { initModel, type Model } from './model';
import type { Msg } from './msg';
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

/** イベントハンドラの中など、描画の外で最新の Model を読むとき用 */
export const getModel = () => useStore.getState().model;

/** プラグインの部品に渡す窓口（plugin-api の PluginContext）。部品は store を直接 import しない */
export const pluginContext: PluginContext = {
  getModel,
  // 外部プラグインの部品は型の確認を通っていないので、Msg の形かを host で確かめてから渡す
  dispatch: (msg: unknown) => {
    if (checkMsgFromPlugin(msg)) useStore.getState().dispatch(msg);
  },
  // zustand は (新しい状態, 前の状態) を渡してくるが、部品には「変わった」ことだけを伝える。
  // 部品が渡す関数も外から来る値なので、host で確かめて例外を受け止める形に包んでから登録する
  subscribe: (listener: unknown) => {
    const safe = listenerFromPlugin(listener);
    if (!safe) return () => {};
    return useStore.subscribe(() => safe());
  },
};
