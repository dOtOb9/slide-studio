// アプリ全体の状態（Zustand）。
// React コンポーネントは useDeckStore(s => s.xxx) で必要な値だけを読む。
// デッキの書き換えは model/commands.ts の関数に任せ、ここは「今どのスライド・どの要素か」を補うだけ。

import { create } from 'zustand';
import * as commands from './model/commands';
import { parseDeck } from './model/parse';
import type { Deck, Rect } from './model/types';
import sample from './samples/sample-deck.html?raw';

/** 画面に描画された要素の実際の位置とサイズ（スライド px）。DOM から測った値 */
export interface Box extends Rect {
  id: string;
}

interface DeckState {
  deck: Deck;
  fileName: string;
  current: number; // 表示中のスライド番号（0 始まり）
  selectedId: string | null; // 選択中の要素
  editingId: string | null; // テキスト編集中の要素
  /**
   * 表示中のスライドの各要素の実際の位置（EditorCanvas が描画後に測って入れる）。
   * left/top や width を書いていない要素もあるので、ファイルの値ではなく「実際に表示された位置」を
   * 移動・リサイズ・矢印キーの起点として使う。Deck の一部ではなく、保存もしない。
   */
  boxes: Box[];
  setBoxes: (boxes: Box[]) => void;

  load: (html: string, fileName: string) => void;
  select: (index: number) => void;
  selectElement: (id: string | null) => void;
  startEditing: (id: string) => void;
  stopEditing: () => void;
  updateElement: (id: string, patch: commands.ElementPatch) => void;
  deleteElement: (id: string) => void;
}

export const useDeckStore = create<DeckState>()((set, get) => {
  /** 表示中のスライドの id */
  const currentSlideId = () => {
    const { deck, current } = get();
    return deck.slides[current].id;
  };

  return {
    deck: parseDeck(sample),
    fileName: 'sample-deck.html',
    current: 0,
    selectedId: null,
    editingId: null,
    boxes: [],
    setBoxes: (boxes) => set({ boxes }),

    load: (html, fileName) =>
      set({ deck: parseDeck(html), fileName, current: 0, selectedId: null, editingId: null }),

    select: (index) => {
      const n = get().deck.slides.length;
      set({ current: Math.max(0, Math.min(n - 1, index)), selectedId: null, editingId: null });
    },

    selectElement: (id) => set({ selectedId: id }),
    startEditing: (id) => set({ selectedId: id, editingId: id }),
    stopEditing: () => set({ editingId: null }),

    updateElement: (id, patch) =>
      set({ deck: commands.updateElement(get().deck, currentSlideId(), id, patch) }),

    deleteElement: (id) =>
      set({ deck: commands.deleteElement(get().deck, currentSlideId(), id), selectedId: null }),
  };
});
