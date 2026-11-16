// ツールバーに並べる機能の部品の登録簿。新しい機能に部品があれば ①② に1行ずつ足す。
// （並列で作業して衝突したら、両方の行を残せばよい）

import type { FeatureView } from './types';

// ① 部品を import する
import { ShapesToolbar } from './shapes/ShapesToolbar';

// ② ツールバーに並べる（この順で並ぶ。1行に1つ、末尾に , を付けて足す）
export const toolbarSections: { name: string; View: FeatureView }[] = [
  { name: 'shapes', View: ShapesToolbar },
];
