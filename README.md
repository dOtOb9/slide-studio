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
  model/          ← React に依存しない純粋な TypeScript（テストあり）
    types.ts        データ構造
    parse.ts        HTML → Deck
    serialize.ts    Deck → HTML（保存用）
    render.ts       Slide → 表示用 HTML（位置を解決して絶対配置にする）
  store.ts        ← アプリの状態（Zustand）
  components/     ← React の画面部品
    SlideView.tsx   スライドを Shadow DOM 内に縮小表示
  App.tsx         ← 画面全体のレイアウト
```

データの流れ: `deck.html` → parse → **Deck（store）** → render → 画面 / serialize → 保存
