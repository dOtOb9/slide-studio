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

位置は `left/top/width/height` を px で書く。それ以外のスタイルは自由。

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
  hooks/          ← DOM の出来事を Msg に変える
    useKeyboard.ts       キー入力
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
