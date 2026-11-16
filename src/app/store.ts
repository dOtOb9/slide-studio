// Model を保持して Msg を受け付ける、薄い箱（Elm でいうランタイム）。
// ロジックは持たない。dispatch(msg) が来たら update に渡し、結果を次の Model にするだけ。
//
// コンポーネントからの使い方:
//   const deck = useModel((m) => m.deck);   // Model の一部を読む（変わったときだけ再描画される）
//   const dispatch = useDispatch();         // Msg を送る
//   dispatch({ type: 'Undo' });

import { create } from 'zustand';
import { parseDeck } from '../model/parse';
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
