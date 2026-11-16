// 機能（feature）の形。
//
// 1つの機能は src/features/<名前>/ にまとめ、次のものを持つ:
//   - feature.ts … Msg の型、update、onKey（React に依存しない純粋な部分）→ features/registry.ts に登録
//   - *.tsx      … ツールバーなどの部品（任意）→ features/toolbar.ts に登録
// 土台（app/）のコードは触らなくてよい。手順は AGENTS.md「機能の足し方」。

import type { ComponentType } from 'react';
import type { Model } from '../app/model';
import type { KeyInput, Msg } from '../app/msg';

/** 機能の Msg の共通形。type が "機能名/出来事" になっている */
export interface FeatureMsgBase {
  type: `${string}/${string}`;
}

/** 機能の純粋な部分。app/update から呼ばれるので、React や store を import しないこと */
export interface Feature<M extends FeatureMsgBase> {
  /** 機能名。Msg の type の "/" より前と一致させる */
  name: string;
  /** この機能の Msg を処理する */
  update(model: Model, msg: M): Model;
  /** 土台が扱わなかったキーを、この機能の Msg に変える（扱わなければ null） */
  onKey?(model: Model, key: KeyInput): M | null;
}

/**
 * 機能の部品が受け取るもの。部品は store を直接 import せず、これを使う
 * （store → update → registry → 機能 の輪ができて、読み込み順で壊れるのを防ぐため）
 */
export interface FeatureViewProps {
  model: Model;
  dispatch: (msg: Msg) => void;
}

export type FeatureView = ComponentType<FeatureViewProps>;
