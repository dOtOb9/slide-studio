// アプリの状態（Elm でいう Model）。
// 画面に出ているもの・操作の途中経過は、すべてここから導けるようにする。

import type { Handle } from '../model/geometry';
import type { Deck, Rect } from '../model/types';

/** スライド座標（px）の点 */
export interface Point {
  x: number;
  y: number;
}

/** 画面に描画された要素の実際の位置とサイズ（スライド px）。DOM から測った値 */
export interface Box extends Rect {
  id: string;
}

/**
 * ドラッグ操作（移動またはリサイズ）の途中経過。
 * pointerdown で作られ、pointerup で消える。
 */
export interface Gesture {
  id: string; // 操作中の要素
  handle: Handle | null; // null なら移動、ハンドルならリサイズ
  start: Point; // 押した時のポインタ位置
  origin: Rect; // 押した時の要素の位置・サイズ
  keepRatio: boolean; // 角のハンドルで縦横比を保つか（画像なら true）
  moved: boolean; // 実際に動いたか（小さな揺れはクリックとみなす）
  before: Deck; // 操作を始める前の Deck。操作が終わったら、これを履歴に1件だけ積む
}

/**
 * 元に戻す／やり直しの履歴。Deck は書き換えずに新しく作る（イミュータブル）ので、
 * 古い Deck をそのまま取っておけば、それが「戻り先」になる。
 */
export interface History {
  past: Deck[]; // 古い順。最後が直前の状態
  future: Deck[]; // 元に戻した分。先頭が直後の状態
}

export interface Model {
  deck: Deck;
  fileName: string;
  /**
   * 最後に保存した（または開いた）時点の Deck。
   * deck !== savedDeck なら未保存の変更がある。元に戻すで保存時点まで戻れば、参照が一致して未保存でなくなる
   */
  savedDeck: Deck;
  /** 新しいスライド・要素の id に使う連番（"n1", "n2", ...）。読み込んだファイルの id（e1, s1 …）とは重ならない */
  nextId: number;
  current: number; // 表示中のスライド番号（0 始まり）
  selectedId: string | null; // 選択中の要素
  editingId: string | null; // テキスト編集中の要素
  /**
   * 表示中のスライドの各要素の実際の位置（描画後に測った値）。
   * left/top や width を書いていない要素もあるので、ファイルの値ではなくこれを
   * 移動・リサイズ・矢印キーの起点にする。保存はしない。
   */
  boxes: Box[];
  gesture: Gesture | null;
  history: History;
  /**
   * 各プラグイン自身の状態。キーはプラグイン名で、中身はそのプラグインだけが読み書きする
   * （helpers.ts の getPluginState / setPluginState を使う）。
   * 保存はせず、元に戻す・やり直しの対象にもならない（履歴に積むのは Deck だけ）。
   * 別のファイルを開いても消さない（ファイルの中身ではなく、操作をまたいで覚える値のため）
   */
  plugins: Record<string, unknown>;
}

/**
 * 新しいスライドに使うレイアウト。基本は表示中のスライドと同じ。
 * ただし表示中が最初のレイアウト（ふつうは表紙）なら、2番目のレイアウト（ふつうはタイトルと本文）にする
 */
export function defaultNewLayout(model: Model): string {
  const { layouts, slides } = model.deck;
  const current = slides[model.current]?.layout;
  if (layouts.length === 0) return current ?? 'blank'; // レイアウトの定義が無いファイル
  const second = layouts[1] ?? layouts[0]; // レイアウトが1つしか無ければそれを使う
  if (!current) return second.name; // スライドが0枚
  if (current === layouts[0].name) return second.name; // 表紙の次
  return current;
}

/** 未保存の変更があるか */
export const isDirty = (model: Model) => model.deck !== model.savedDeck;

export function initModel(deck: Deck, fileName: string): Model {
  return {
    deck,
    fileName,
    savedDeck: deck,
    nextId: 1,
    current: 0,
    selectedId: null,
    editingId: null,
    boxes: [],
    gesture: null,
    history: { past: [], future: [] },
    plugins: {},
  };
}
