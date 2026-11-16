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
  features/       ← 個々の機能（土台を触らずに足せる。AGENTS.md「機能の足し方」）
    types.ts        機能の形（Feature、部品が受け取る props）
    registry.ts     機能の登録簿（純粋な部分。update から呼ばれる）
    toolbar.ts      ツールバーに並べる部品の登録簿
    shapes/         図形・テキストボックスの挿入（機能の手本）
  io/             ← ファイルの読み書き（Elm でいう Cmd）
    file.ts              File System Access API（無ければ input / ダウンロード）
    commands.ts          開く・保存の手順（終わったら Msg を送る）
  hooks/          ← DOM の出来事を Msg に変える
    useKeyboard.ts       キー入力
    useUnsavedGuard.ts   未保存の表示と、閉じるときの確認
    useBoxMeasurement.ts 描画後の要素位置の測定
    useTextEditing.ts    テキスト編集（contentEditable）
    useElementSize.ts    領域の大きさ
  components/     ← 画面部品（Model を読んで描画し、Msg を送る）
    Toolbar.tsx        開く・元に戻す・やり直し
    ThumbnailList.tsx  スライド一覧
    Stage.tsx          中央の作業領域
    EditorCanvas.tsx   キャンバス（プロキシ・選択枠）
    SelectionFrame.tsx 選択枠とリサイズ用ハンドル
    SlideView.tsx      スライドを Shadow DOM 内に縮小表示
  App.tsx         ← 画面全体の配置
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
| ツールバー | 上記に加え、レイアウトを選んでスライド追加、スライドの削除、テキスト・四角・円・矢印の挿入 |
| ノート欄（キャンバスの下） | 発表者ノート。フォーカスを外すと確定し、元に戻せる |

空のプレースホルダーには、編集画面だけ「ダブルクリックしてタイトルを入力」などの案内が出る（保存・書き出しには含まれない）。
