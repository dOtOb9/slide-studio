// アプリ全体の状態（Zustand）。
// React コンポーネントは useDeckStore(s => s.xxx) で必要な値だけを読む。

import { create } from 'zustand';
import { parseDeck } from './model/parse';
import type { Deck } from './model/types';
import sample from './samples/sample-deck.html?raw';

interface DeckState {
  deck: Deck;
  fileName: string;
  current: number; // 表示中のスライド番号（0 始まり）
  load: (html: string, fileName: string) => void;
  select: (index: number) => void;
}

export const useDeckStore = create<DeckState>()((set, get) => ({
  deck: parseDeck(sample),
  fileName: 'sample-deck.html',
  current: 0,

  load: (html, fileName) => set({ deck: parseDeck(html), fileName, current: 0 }),

  select: (index) => {
    const n = get().deck.slides.length;
    set({ current: Math.max(0, Math.min(n - 1, index)) });
  },
}));
