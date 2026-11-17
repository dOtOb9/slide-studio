// プラグインに公開する API（プラグインが使ってよいものの一覧）。
//
// プラグインは、このファイルが export するものだけを使う。アプリの内部（app/・model/ のほかの関数）を
// 直接 import しない。こうしておけば、内部を作り替えても、ここの形を保つ限りプラグインは壊れない。
//
// - 同梱のプラグイン（src/plugins/）は、ここから普通に import する。
// - 外部のプラグイン（ファイルや URL から読み込む .js）はアプリのソースを import できないので、
//   読み込まれるときに下の `api` オブジェクトを引数で受け取る（README「プラグイン」）。
//
// このファイルは React に依存しない（プラグインの update から使われるため）。
// React で部品を書くための橋渡しは ./react.tsx にある。
//
// 互換性: API_VERSION は「メジャー.マイナー」。
//   - 関数や欄を足しただけ（今までのプラグインはそのまま動く）→ マイナーを上げる
//   - 消した・意味を変えた（今までのプラグインが壊れうる）→ メジャーを上げる
// 部品の見た目の約束（README「プラグイン」の共通クラスと CSS 変数）も API に含める。消す・意味を変えるならメジャー。
// プラグインは、自分が作られたときの版を apiVersion に書く。
// 読み込めるのは「メジャーが同じで、マイナーがアプリ以下」のもの（isCompatible）。

import {
  currentSlide,
  edit,
  findElement,
  getPluginState,
  isBusy,
  setPluginState,
  withNewIds,
} from '../app/helpers';
import type { Model } from '../app/model';
import type { KeyInput, Msg, PluginMsg } from '../app/msg';
import { imagePathOf, sha256Hex } from '../io/images';
import { deleteElement, insertElement, setNotes, updateElement } from '../model/commands';
import { checkImageFile, extensionOf, imagePath, isImagePath } from '../model/images';

// 1.1: 部品の見た目の約束（共通クラス .button / .icon-button と CSS 変数。README「プラグイン」）を足した
// 1.2: images/ の画像（Model.images、Msg の ImagesAdded、imagePathOf / sha256Hex / imagePath / isImagePath）を足した
// 1.3: 受け取った画像のファイルを確かめる checkImageFile / extensionOf を足した（画像の挿入のプラグインが、
//      土台と同じ上限・同じ対応形式で断れるように）
export const API_VERSION = '1.3';

// --- 型 ---------------------------------------------------------------------

export type { KeyInput, Model, Msg, PluginMsg };
export type { Deck, Layout, Placeholder, Rect, Slide, SlideElement } from '../model/types';
export type { ElementPatch } from '../model/commands';

/** 部品（ツールバーのボタンなど）がアプリとやり取りする窓口 */
export interface PluginContext {
  /** 今の Model を読む */
  getModel(): Model;
  /** Msg を送る（状態を変える唯一の入口） */
  dispatch(msg: Msg): void;
  /** Model が変わるたびに呼ばれる関数を登録する。戻り値を呼ぶと登録を外す */
  subscribe(listener: () => void): () => void;
}

/**
 * プラグインの部品。React などの UI フレームワークに依存しない形にしている:
 * 渡された container の中に自由に DOM を作り、片付ける関数を返す。
 * （React を使わない人も作れ、アプリと React の版が違っても壊れない。React で書くなら ./react.tsx の reactView）
 */
export interface PluginView {
  mount(container: HTMLElement, ctx: PluginContext): () => void;
}

/**
 * プラグインの形。M はそのプラグインの Msg の型。
 * すべて任意（update も部品も無い、キー操作だけのプラグインもありうる）。
 */
export interface Plugin<M extends PluginMsg = PluginMsg> {
  /** プラグイン名。英小文字・数字・ハイフン（例: 'shapes'）。Msg の type の "/" より前と一致させる */
  name: string;
  /** 作ったときの API の版（例: '1.0'） */
  apiVersion: string;
  /** 一覧に出す名前と説明 */
  title?: string;
  description?: string;
  /** このプラグインの Msg を処理する純粋関数 */
  update?(model: Model, msg: M): Model;
  /** 土台が扱わなかったキーを、このプラグインの Msg に変える（扱わなければ null） */
  onKey?(model: Model, key: KeyInput): M | null;
  /** ツールバーに置く部品 */
  toolbar?: PluginView;
}

// --- 関数 -------------------------------------------------------------------

export {
  checkImageFile,
  currentSlide,
  deleteElement,
  edit,
  extensionOf,
  findElement,
  getPluginState,
  imagePath,
  imagePathOf,
  insertElement,
  isBusy,
  isImagePath,
  setNotes,
  setPluginState,
  sha256Hex,
  updateElement,
  withNewIds,
};

/** 外部プラグインに渡す API 一式（中身は上で export しているものと同じ） */
export const api = {
  version: API_VERSION,
  // Model を扱う道具
  edit,
  withNewIds,
  currentSlide,
  findElement,
  isBusy,
  getPluginState,
  setPluginState,
  // Deck の編集
  insertElement,
  updateElement,
  deleteElement,
  setNotes,
  // images/ の画像（1.2〜）。画像を置く手順:
  //   1. 部品で画像の Blob を受け取る（ファイル選択・貼り付けなど）
  //   2. const path = await imagePathOf(blob)   … images/<SHA-256>.<拡張子>（対応しない型なら null）
  //   3. ctx.dispatch({ type: 'ImagesAdded', images: { [path]: blob } })   … 中身を Model.images に入れる
  //   4. 自分の Msg の update で insertElement(…, { tag: 'img', attrs: { src: path }, … }) を edit() に通す
  // 中身は model.images[path] で読める（増えるだけで消えない。別のファイルを開くと空になる）
  imagePathOf,
  sha256Hex,
  imagePath,
  isImagePath,
  // 受け取ったファイルを確かめる（1.3〜）。手順の 1 と 2 の間で使う:
  //   checkImageFile(file) … File でない・空・画像でない型・大きすぎる なら理由の文字列（よければ null）
  //   extensionOf(type)    … images/ に置ける MIME 型なら拡張子（置けない型なら null）
  checkImageFile,
  extensionOf,
};

export type PluginApi = typeof api;

/** プラグインの apiVersion が、このアプリで動くか */
export function isCompatible(pluginVersion: string, appVersion: string = API_VERSION): boolean {
  const parse = (v: string) => {
    const m = /^(\d+)\.(\d+)$/.exec(v);
    return m ? { major: Number(m[1]), minor: Number(m[2]) } : null;
  };
  const p = parse(pluginVersion);
  const a = parse(appVersion);
  if (!p || !a) return false;
  return p.major === a.major && p.minor <= a.minor;
}
