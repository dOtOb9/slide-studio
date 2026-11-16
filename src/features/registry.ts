// 機能の登録簿（純粋な部分）。新しい機能を足すときは、下の ①②③ に1行ずつ足す。
// 並列で作業すると、ここと features/toolbar.ts で行の追加どうしが衝突する。そのときは両方の行を残せばよい。
//
// このファイルは app/update から読まれるので、React の部品（.tsx）を import しないこと。

import type { Model } from '../app/model';
import type { KeyInput, Msg } from '../app/msg';
import type { Feature } from './types';

// ① 各機能の純粋な部分を import する
import { shapes, type ShapesMsg } from './shapes/feature';

// ② 各機能の Msg をまとめた型（1行に1つ、先頭に | を付けて足す）
export type FeatureMsg =
  | ShapesMsg
  ;

// ③ 機能の一覧（1行に1つ、末尾に , を付けて足す）
export const features: Feature<FeatureMsg>[] = [
  shapes,
];

// --- ここから下は、機能を足すときに触る必要はない -------------------------------

export function isFeatureMsg(msg: Msg): msg is FeatureMsg {
  return msg.type.includes('/');
}

/** Msg の type の "/" より前を見て、その機能の update に渡す */
export function updateFeature(model: Model, msg: FeatureMsg): Model {
  const name = msg.type.split('/')[0];
  const feature = features.find((f) => f.name === name);
  // 見つからないのは、機能の name と Msg の接頭辞が食い違っているか、登録し忘れ。黙って捨てずに知らせる
  if (!feature) throw new Error(`登録されていない機能の Msg: ${msg.type}`);
  return feature.update(model, msg);
}

/** 土台が扱わなかったキーを、各機能に順に聞く。どれかが Msg を返したら、それを update で処理する */
export function featureKey(model: Model, key: KeyInput, update: (model: Model, msg: Msg) => Model): Model | null {
  for (const f of features) {
    const msg = f.onKey?.(model, key);
    if (msg) return update(model, msg);
  }
  return null;
}
