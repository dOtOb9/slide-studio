// 機能（feature）の形。
//
// 1つの機能は src/features/<名前>/ にまとめ、次のものを持つ:
//   - その機能の Msg（type は必ず "<名前>/<出来事>" の形）
//   - その Msg を処理する update（Model → Model の純粋関数）
//   - 必要なら、キー操作を Msg に変える onKey と、ツールバーに出す部品 ToolbarSection
// 作ったら features/registry.ts に1行ずつ登録する。土台（app/）のコードは触らなくてよい。

import type { ComponentType } from 'react';
import type { Model } from '../app/model';
import type { KeyInput } from '../app/msg';

/** 機能の Msg の共通形。type が "機能名/出来事" になっている */
export interface FeatureMsgBase {
  type: `${string}/${string}`;
}

export interface Feature<M extends FeatureMsgBase> {
  /** 機能名。Msg の type の "/" より前と一致させる */
  name: string;
  /** この機能の Msg を処理する */
  update(model: Model, msg: M): Model;
  /** 土台が扱わなかったキーを、この機能の Msg に変える（扱わなければ null） */
  onKey?(model: Model, key: KeyInput): M | null;
  /** ツールバーに並べる部品 */
  ToolbarSection?: ComponentType;
}
