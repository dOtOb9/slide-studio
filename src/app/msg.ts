// アプリで起こりうる出来事の一覧（Elm でいう Msg）。
// view は「何が起きたか」を Msg として送るだけで、どう変わるかは update が決める。
//
// TypeScript の「判別可能な共用体」: type 欄の値で種類を見分ける。Elm のカスタム型に相当する。

import type { Handle } from '../model/geometry';
import type { Deck } from '../model/types';
import type { Box, Point } from './model';

export type Msg =
  // ファイル（読み書き自体は io/ で行い、終わった結果だけを送る）
  | { type: 'DeckLoaded'; deck: Deck; fileName: string }
  | { type: 'DeckSaved'; deck: Deck; fileName: string } // deck は「保存した時点の」Deck
  // スライドの操作
  | { type: 'SlideSelected'; index: number }
  | { type: 'SlideAdded'; after: number; layout: string }
  | { type: 'SlideDuplicated'; index: number }
  | { type: 'SlideDeleted'; index: number }
  | { type: 'SlideMoved'; from: number; to: number }
  // 要素の選択
  | { type: 'ElementSelected'; id: string | null }
  // ドラッグ（移動・リサイズ）。pointer はスライド座標
  | { type: 'DragStarted'; id: string; handle: Handle | null; pointer: Point }
  | { type: 'DragMoved'; pointer: Point; shift: boolean }
  | { type: 'DragEnded' }
  // テキスト編集
  | { type: 'EditRequested'; id: string }
  | { type: 'TextCommitted'; id: string; html: string }
  // キーボード（mod は Ctrl または Mac の Cmd）
  | { type: 'KeyPressed'; key: string; shift: boolean; mod: boolean }
  // 描画後に測った要素の位置
  | { type: 'BoxesMeasured'; boxes: Box[] }
  // 履歴
  | { type: 'Undo' }
  | { type: 'Redo' };
