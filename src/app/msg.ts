// アプリで起こりうる出来事の一覧（Elm でいう Msg）。
// view は「何が起きたか」を Msg として送るだけで、どう変わるかは update が決める。
//
// TypeScript の「判別可能な共用体」: type 欄の値で種類を見分ける。Elm のカスタム型に相当する。
//
// Msg = CoreMsg（アプリの土台の出来事。下に一覧）
//     | PluginMsg（各プラグインの出来事。type が "プラグイン名/出来事"）

import type { Handle } from '../model/geometry';
import type { Deck } from '../model/types';
import type { Box, Point } from './model';

/** 押されたキー（mod は Ctrl または Mac の Cmd） */
export interface KeyInput {
  key: string;
  shift: boolean;
  mod: boolean;
}

export type CoreMsg =
  // ファイル（読み書き自体は io/ で行い、終わった結果だけを送る）
  | { type: 'DeckLoaded'; deck: Deck; fileName: string }
  | { type: 'DeckSaved'; deck: Deck; fileName: string } // deck は「保存した時点の」Deck
  // スライドの操作
  | { type: 'SlideSelected'; index: number }
  | { type: 'SlideAdded'; after: number; layout: string }
  | { type: 'SlideDuplicated'; index: number }
  | { type: 'SlideDeleted'; index: number }
  | { type: 'SlideMoved'; from: number; to: number }
  | { type: 'NotesCommitted'; index: number; notes: string } // 発表者ノートの入力を確定した
  // 要素の選択
  | { type: 'ElementSelected'; id: string | null }
  // ドラッグ（移動・リサイズ）。pointer はスライド座標
  | { type: 'DragStarted'; id: string; handle: Handle | null; pointer: Point }
  | { type: 'DragMoved'; pointer: Point; shift: boolean }
  | { type: 'DragEnded' }
  // テキスト編集
  | { type: 'EditRequested'; id: string }
  | { type: 'TextCommitted'; id: string; html: string }
  // キーボード
  | ({ type: 'KeyPressed' } & KeyInput)
  // 描画後に測った要素の位置
  | { type: 'BoxesMeasured'; boxes: Box[] }
  // 履歴
  | { type: 'Undo' }
  | { type: 'Redo' };

/**
 * プラグインの Msg の共通形。type が "プラグイン名/出来事"（例: 'shapes/Inserted'）。
 *
 * プラグインは実行時に後から入るので、ここでは「/ を含む type を持つ何か」としか書けない。
 * そのため土台の update はプラグインの Msg を網羅チェックできない（プラグインの中では、
 * 自分の Msg の型で網羅チェックできる）。
 *
 * 各プラグインは自分の Msg を `type`（interface ではなく）で書く。type で書いた型だけが、
 * 下の [key: string]: unknown に当てはまるため。
 */
export type PluginMsg = { type: `${string}/${string}`; [key: string]: unknown };

export type Msg = CoreMsg | PluginMsg;
