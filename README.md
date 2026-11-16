# Slide Studio

HTML で書けて（AI が編集しやすい）、PowerPoint のように GUI で直せるスライドエディタ。

## 起動

```
npm install
npm run dev     # http://localhost:5173
npx vitest      # テスト
```

## ファイル形式（deck.html）

| 書き方 | 意味 |
|---|---|
| `<meta name="slide-size" content="1920x1080">` | スライドの大きさ |
| `<style>` | テーマ CSS |
| `<template data-layout="名前">` | レイアウト（マスター）。中の `data-ph` がプレースホルダー |
| `<section data-layout="名前">` | スライド1枚 |
| `<div data-ph="title">` | プレースホルダー。位置はレイアウトから継承し、`style` に書いた分だけ上書き |
| `<div data-el style="left:..px; top:..px; width:..px; height:..px">` | 自由配置の要素 |
| `<div data-el data-shape="rect">` / `data-shape="ellipse"` | 図形（四角・円）。色などは `style` に書く |
| `<svg data-el data-shape="arrow" viewBox="..." preserveAspectRatio="none">` | 線・矢印などの SVG 図形。`vector-effect="non-scaling-stroke"` を付けると伸ばしても線の太さが変わらない |
| `<img data-el src="data:image/png;base64,...">` | 画像。いまは HTML に埋め込む（1ファイルで持ち運べるため）。別ファイル参照（`src="images/a.png"`）も表示はできる |
| `<aside data-notes>…</aside>` | 発表者ノート（section の中に1つ、プレーンテキスト）。スライドには描画されない。複数あれば改行でつないで読み、保存すると1つにまとまる |

位置は `left/top/width/height` を px で書く。それ以外のスタイルは自由。
`section` の直下の要素は、`data-el` が付いていなくても自由配置の要素として扱う（AI が付け忘れても壊れないように）。

## 構成

```
src/
  app/            ← TEA の中核（React に依存しない、テストあり）
    model.ts        Model（アプリの状態）
    msg.ts          Msg（起こりうる出来事）
    update.ts       update(model, msg) → model、元に戻す／やり直し
    store.ts        Model を保持して dispatch を受ける（Zustand）
  model/          ← ファイル形式と Deck の操作（React に依存しない、テストあり）
    types.ts        データ構造
    parse.ts        HTML → Deck
    serialize.ts    Deck → HTML（保存用）
    render.ts       Slide → 表示用 HTML（位置を解決して絶対配置にする）
    commands.ts     編集操作（古い Deck → 新しい Deck）
    geometry.ts     リサイズなどの位置計算
  plugin-api/     ← プラグインに公開する API（下記「プラグイン」）
    index.ts        型・関数・API_VERSION・外部プラグインに渡す api
    react.tsx       React で書いた部品をプラグインの部品にする橋渡し（reactView）
  plugins/        ← 個々の機能（土台を触らずに足せる。AGENTS.md「プラグインの足し方」）
    host.ts         プラグインホスト（実行時の登録・有効／無効、Msg とキーの振り分け）
    builtin.ts      同梱のプラグインの一覧（起動時に登録する）
    shapes/         図形・テキストボックスの挿入（プラグインの手本）
  io/             ← ファイルの読み書き（Elm でいう Cmd）
    file.ts              File System Access API（無ければ input / ダウンロード）
    commands.ts          開く・保存の手順（終わったら Msg を送る）
    plugins.ts           外部プラグインの読み込み（ファイル・URL から import()）
  hooks/          ← DOM の出来事を Msg に変える
    useKeyboard.ts       キー入力
    useUnsavedGuard.ts   未保存の表示と、閉じるときの確認
    useBoxMeasurement.ts 描画後の要素位置の測定
    useTextEditing.ts    テキスト編集（contentEditable）
    useElementSize.ts    領域の大きさ
    usePlugins.ts        プラグインの一覧を読む
  components/     ← 画面部品（Model を読んで描画し、Msg を送る）
    Toolbar.tsx        開く・元に戻す・やり直し
    IconButton.tsx     アイコンだけのボタン（説明はツールチップ）
    PluginSlot.tsx     プラグインの部品を置く場所（mount / unmount を呼ぶ）
    PluginManager.tsx  プラグインの一覧（有効／無効・読み込み）
    ThumbnailList.tsx  スライド一覧
    Stage.tsx          中央の作業領域
    EditorCanvas.tsx   キャンバス（プロキシ・選択枠）
    SelectionFrame.tsx 選択枠とリサイズ用ハンドル
    SlideView.tsx      スライドを Shadow DOM 内に縮小表示
  App.tsx         ← 画面全体の配置
examples/         ← 外部プラグインの例（sticky-note: 付箋）
```

データの流れ（Elm の TEA と同じ）: 操作 → **Msg** → **update** → **Model** → 画面

## 操作

| 操作 | 動作 |
|---|---|
| クリック / ドラッグ | 選択 / 移動 |
| ハンドル | リサイズ（画像は角で縦横比を保つ。Shift で反転） |
| ダブルクリック / Enter | テキスト編集（Esc か外側クリックで確定） |
| Delete | 削除 |
| 矢印キー | 1px 移動（Shift で 10px）。未選択時はスライド移動 |
| Ctrl+Z / Ctrl+Y（Ctrl+Shift+Z） | 元に戻す / やり直し |
| Ctrl+O / Ctrl+S / Ctrl+Shift+S | 開く / 上書き保存 / 名前を付けて保存（Chrome・Edge は開いたファイルに直接上書き。他のブラウザはダウンロード） |
| Ctrl+M | 新しいスライド（表示中と同じレイアウト。表紙からなら2番目のレイアウト） |
| Ctrl+D（要素を選んでいないとき） | スライドの複製 |
| サムネイルのドラッグ | スライドの並べ替え |
| ツールバー | 上記に加え、レイアウトを選んでスライド追加（＋）、スライドの削除、テキスト・四角・円・矢印の挿入。ボタンはアイコンで、説明はマウスを乗せると出る |
| ノート欄（キャンバスの下） | 発表者ノート。フォーカスを外すと確定し、元に戻せる |
| パズルのアイコン | プラグインの一覧。有効／無効の切り替え、外部プラグインの読み込み（ファイル・URL）と取り外し |

空のプレースホルダーには、編集画面だけ「ダブルクリックしてタイトルを入力」などの案内が出る（保存・書き出しには含まれない）。

## プラグイン

すべての機能（図形の挿入など）はプラグインとして作られていて、後から外部のプラグインを読み込める。
同梱のプラグインも外部のプラグインも、起動時・読み込み時に同じ仕組み（`registerPlugin`）で登録される。

**注意: 外部のプラグインはアプリと同じ権限で動く。信頼できるものだけを読み込むこと。**
読み込んだ外部プラグインは、ページを開き直すと外れる（いまは覚えておかない）。

### 外部プラグインの書き方

1ファイルの ES モジュール（素の JavaScript、ビルド不要）。ほかのファイルは import しない。
アプリの API は引数で受け取る。手本は [examples/sticky-note/plugin.js](examples/sticky-note/plugin.js)。

```js
export default function myPlugin(api) {   // api: アプリの API（plugin-api の `api`）
  return {
    name: 'my-plugin',                     // 英小文字・数字・ハイフン。Msg の接頭辞になる
    apiVersion: '1.0',                     // 作ったときの API の版
    title: '表示名',
    update(model, msg) {                   // (Model, Msg) → Model の純粋関数。msg.type は 'my-plugin/…'
      return model;
    },
    onKey(model, key) { return null; },    // 任意。土台が扱わなかったキーを自分の Msg に変える
    toolbar: {                             // 任意。ツールバーの部品
      mount(container, ctx) {              // container に DOM を作る。ctx: getModel / dispatch / subscribe
        return () => {};                   // 片付ける関数を返す
      },
    },
  };
}
```

| api の中身 | 用途 |
|---|---|
| `edit(model, deck)` | Deck を変える（元に戻すの履歴に1件積む） |
| `withNewIds(model, fn)` | 新しい要素の id を作る（返り値の `nextId` を Model に入れる） |
| `currentSlide` / `findElement` / `isBusy` | 表示中のスライド、表示中のスライドの要素、ドラッグ・編集中か |
| `insertElement` / `updateElement` / `deleteElement` / `setNotes` | Deck の編集（新しい Deck を返す） |
| `getPluginState` / `setPluginState` | プラグイン自身の状態（`model.plugins[名前]`。保存せず、元に戻すの対象外） |
| `version` | アプリの API の版 |

**版の互換性**: API の版は「メジャー.マイナー」。プラグインの `apiVersion` のメジャーがアプリと同じで、マイナーがアプリ以下なら読み込める。
型の一覧は [src/plugin-api/index.ts](src/plugin-api/index.ts)。

読み込み: ツールバーの「🧩 プラグイン」→「ファイルから読み込む…」か、URL を入れて「URL から読み込む」
（URL の場合は、そのサーバーが CORS を許可している必要がある）。
