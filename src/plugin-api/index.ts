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
import { deleteElement, insertElement, setNotes, updateElement } from '../model/commands';

export const API_VERSION = '1.0';

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
  currentSlide,
  deleteElement,
  edit,
  findElement,
  getPluginState,
  insertElement,
  isBusy,
  setNotes,
  setPluginState,
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
