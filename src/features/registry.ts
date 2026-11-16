// 機能の登録簿。新しい機能を足すときは、このファイルの2か所に1行ずつ足すだけ。
// （並列で作業するときに衝突しやすいのはここだけになる。どちらも行の追加なので解消は簡単）

import type { Model } from '../app/model';
import type { KeyInput, Msg } from '../app/msg';
import { shapes, type ShapesMsg } from './shapes';
import type { Feature } from './types';

// ① 各機能の Msg をまとめた型
export type FeatureMsg =
  | ShapesMsg;

// ② 機能の一覧（ツールバーにはこの順で並ぶ）
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
  return feature ? feature.update(model, msg) : model;
}

/** 土台が扱わなかったキーを、各機能に順に聞く。どれかが Msg を返したら、それを update で処理する */
export function featureKey(model: Model, key: KeyInput, update: (model: Model, msg: Msg) => Model): Model | null {
  for (const f of features) {
    const msg = f.onKey?.(model, key);
    if (msg) return update(model, msg);
  }
  return null;
}
