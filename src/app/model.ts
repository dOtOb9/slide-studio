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
}

export function initModel(deck: Deck, fileName: string): Model {
  return {
    deck,
    fileName,
    current: 0,
    selectedId: null,
    editingId: null,
    boxes: [],
    gesture: null,
    history: { past: [], future: [] },
  };
}
