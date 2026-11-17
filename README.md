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
| `<img data-el src="images/<ハッシュ>.png">` | 画像。deck.html の隣の `images/` フォルダに普通の画像ファイルとして置き、相対パスで参照する（下記「画像」） |
| `<aside data-notes>…</aside>` | 発表者ノート（section の中に1つ、プレーンテキスト）。スライドには描画されない。複数あれば改行でつないで読み、保存すると1つにまとまる |

### 画像（images/）

- 画像は `images/` フォルダの直下に置き、名前は**中身の SHA-256（16進64文字）+ 拡張子**（`png` `jpg` `jpeg` `gif` `webp` `svg` `avif`）。
  名前が中身から決まるので、同じ名前のファイルは書き直さない。使わなくなった画像も消さない。
- アプリが管理するのは「`section` 直下の `img` 要素の `src` が `images/<英数字・_・->.<拡張子>` のもの」だけ。
  要素の中身の HTML に書いた `<img>`、テーマ CSS の `url()`、`../` や入れ子のフォルダを含むパス、外部の URL は対象外で、書いたまま残す
  （表示はブラウザ任せ。images/ の画像のように Blob URL に差し替えないので、多くの場合は表示されない）。
- 古い形式の埋め込み（`src="data:image/png;base64,..."`）も今までどおり読め、保存しても埋め込みのまま（images/ に移さない）。
- Chrome・Edge で開いたファイルが images/ の画像を使っていると、ツールバーに鍵の付いたフォルダのアイコン（フォルダへのアクセスを許可）が出る。
  押してファイルのあるフォルダを選ぶと、images/ の画像を読んで表示する（ほかのフォルダを選ぶと断る）。
  保存するとき、新しい画像は images/ に書く（フォルダの許可がまだなら、そのときフォルダを選ぶ）。
  フォルダに書けないとき（フォルダの選択をキャンセルした・別のフォルダを選んだ・デスクトップ直下などブラウザが選ばせないフォルダ）は、
  画像を data URI で deck.html に埋め込んで保存し、そのことを知らせる。埋め込んで保存したファイルは古い形式と同じ扱いになる（次に開いて保存しても埋め込みのまま）。
- フォルダを読み書きできないブラウザ（ダウンロードで保存する）では、画像を data URI で埋め込んだ1ファイルとして保存する。
- 読み込めていない画像（中身の無い images/ の画像）は `images/…` の参照のまま保存するので、開いたファイルと別のフォルダへ保存する
  （名前を付けて保存で許可済みのフォルダの外を選ぶ・ダウンロードで保存する）ときは、保存する前に続けるかを聞く。上書き保存では聞かない。
  フォルダを許可していなければピッカーの前に聞くので、やめても何も作られない。許可済みなら選んだ後に聞くため、やめると選んだファイルが空で残る（ブラウザがピッカーの時点で作るため）。
- images/ から読む画像は 1つ 50MB まで。空・画像でない・大きすぎるファイルは読まない（理由はコンソールに出る）。

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
    images.ts       images/ の画像パスの判定・使っている画像の一覧
  plugin-api/     ← プラグインに公開する API（下記「プラグイン」）
    index.ts        型・関数・API_VERSION・外部プラグインに渡す api
    react.tsx       React で書いた部品をプラグインの部品にする橋渡し（reactView）
  plugins/        ← 個々の機能（土台を触らずに足せる。AGENTS.md「プラグインの足し方」）
    host.ts         プラグインホスト（実行時の登録・有効／無効、Msg とキーの振り分け）
    builtin.ts      同梱のプラグインの一覧（起動時に登録する）
    shapes/         図形・テキストボックスの挿入（プラグインの手本）
  io/             ← ファイルの読み書き（Elm でいう Cmd）
    file.ts              File System Access API（無ければ input / ダウンロード）。images/ の読み書きも
    images.ts            画像のハッシュ・表示用の Blob URL・埋め込み用の data URI
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
| 鍵の付いたフォルダのアイコン | images/ の画像を表示するため、ファイルのあるフォルダへのアクセスを許可する（画像を読めていないときだけ出る） |
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
| `imagePathOf(blob)` | 画像の Blob から置き場所のパス `images/<SHA-256>.<拡張子>` を作る（非同期。対応しない型なら `null`）。1.2 から |
| `sha256Hex(blob)` / `imagePath(hash, mimeType)` / `isImagePath(src)` | 上の部品: 中身のハッシュ（非同期）、ハッシュと型からパス、管理対象の画像パスか。1.2 から |
| `checkImageFile(file)` / `extensionOf(mimeType)` | 受け取った画像のファイルを確かめる: だめなら理由の文字列（File でない・空・画像でない・50MB 超）、images/ に置ける型なら拡張子（置けなければ `null`）。1.3 から |
| `version` | アプリの API の版 |

**Plugin の欄**（`name` と `apiVersion` のほかは任意。キー操作だけ・部品だけのプラグインもありうる）

| 欄 | 約束 |
|---|---|
| `name` | 英小文字で始まる英小文字・数字・ハイフン。自分の Msg の type の `/` より前と一致させる（ずれると Msg が届かず、コンソールに警告が出る） |
| `apiVersion` | 作ったときの API の版（例: `'1.0'`）。下の「版の互換性」 |
| `title` / `description` | プラグインの一覧に出す名前と説明（文字列） |
| `update(model, msg)` | 自分の Msg を処理する純粋関数。Model を返す（`...model` を展開して作る。欄が欠けた Model や例外は断られ、Model はそのまま） |
| `onKey(model, key)` | 土台が扱わなかったキーを自分の Msg に変える。扱わないなら `null`。返してよいのは自分の Msg だけ（土台の Msg を返すと断られる）。`key.mod` は Ctrl または Mac の Cmd |
| `toolbar.mount(container, ctx)` | container の中に DOM を作り、片付ける関数を返す。UI フレームワークに依存しない形なので、React を使わなくても作れ、アプリと React の版が違っても壊れない |

| ctx の中身 | 用途 |
|---|---|
| `getModel()` | 今の Model を読む |
| `dispatch(msg)` | Msg を送る（状態を変える唯一の入口）。Msg の形（type が文字列のオブジェクト）でないものは捨てられる |
| `subscribe(fn)` | Model が変わるたびに `fn` を呼ぶ。戻り値を呼ぶと外れる。`fn` が例外を出しても、アプリと他の部品は止まらない |

**Model の主な欄**（読むときの約束。書き換えは `edit` / `setPluginState` などを通す）

| 欄 | 意味 |
|---|---|
| `deck` / `savedDeck` | 今の Deck / 最後に保存した（開いた）時点の Deck。`deck !== savedDeck` なら未保存（参照で比べるので、元に戻すで保存時点まで戻れば未保存でなくなる） |
| `current` / `selectedId` / `editingId` | 表示中のスライド番号（0 始まり）/ 選択中の要素 / テキスト編集中の要素 |
| `boxes` | 表示中のスライドの各要素の、描画後に測った位置と大きさ（スライド px）。ファイルに幅・高さが無い要素もあるので、位置の起点にはこちらを使う。保存しない |
| `gesture` | ドラッグ（移動・リサイズ）の途中経過。`handle` が `null` なら移動。`before` は始める前の Deck で、終わったときに履歴へ1件だけ積む |
| `history` | `past` は古い順（最後が直前）、`future` は元に戻した分（先頭が直後） |
| `nextId` | 新しいスライド・要素の id の連番（`n1`, `n2`, …）。読み込んだファイルの id（`e1`, `s1`, …）とは重ならない。`withNewIds` が進める |
| `plugins` | 各プラグイン自身の状態（`getPluginState` / `setPluginState`）。保存せず、元に戻すの対象外。別のファイルを開いても残る |
| `images` | images/ の画像の中身（パス → Blob）。履歴にも未保存の判定にも入らず、増えるだけで消えない。別のファイルを開くと空になる |
| `canReadFolder` | 開いたファイルの隣の images/ を読みに行けるか（Chrome・Edge でファイルを開いたとき true） |

**Deck の型**: 位置と大きさ（`Rect` の `x` `y` `w` `h`）はスライド座標の px（1920×1080 が基準）。
`SlideElement` の `id` はアプリの中だけで使い、ファイルには保存しない。`ph` があればプレースホルダーで、`rect` はレイアウトの位置への上書き分だけ。
`style` は位置以外のインラインスタイル、`attrs` は `src` などその他の属性、`html` は中身の HTML。`Slide` の `notes` はプレーンテキスト。

**画像を置く**（1.2 から）: 画像の中身は Deck ではなく `model.images`（パス → Blob。保存のときに images/ に書かれる）に入る。
部品で Blob を受け取ったら `imagePathOf` でパスを作り、`ctx.dispatch({ type: 'ImagesAdded', images: { [パス]: blob } })` で中身を渡してから、
自分の Msg の update で `insertElement` を使い `{ tag: 'img', attrs: { src: パス }, … }` を置く。
`ImagesAdded` は、キーが画像のパスでない・値が Blob でない項目を捨て、すでにある画像は上書きしない。

### 部品の見た目（共通のクラスと色）

部品をアプリと同じ見た目にするには、アプリのスタイルにある次のクラスと CSS 変数を使う（API 1.1 から）。
アプリの UI の方針: 区切りは線でなく背景の色差と余白で表し、ボタンはアイコンにして説明はツールチップ（`title`）に書く。

| クラス | 用途 |
|---|---|
| `button.icon-button` | アイコンだけのボタン（32px 四方）。中に SVG（24×24 の viewBox、`stroke="currentColor"`）を入れると 18px で表示され、hover・無効の色に従う。`title` と `aria-label` に説明を書く |
| `button.button` | 文字のボタン（どうしても文字が要るとき） |

ツールバーの部品は、くぼんだ背景のまとまりの中に置かれる（中のボタンは背景が透明になる）。
アイコンはアプリと同じ [lucide](https://lucide.dev)（ISC ライセンス）の形を写すとそろう。手本は examples/sticky-note。

| CSS 変数 | 意味 |
|---|---|
| `--bg-surface` / `--bg-sunken` / `--bg-app` | 面 / 面の中のくぼみ / 一番下の地 |
| `--bg-hover` / `--bg-selected` | 乗ったとき / 選んでいるもの |
| `--fg` / `--fg-muted` / `--accent` | 文字 / 控えめな文字 / 強調 |

クラス名と変数は API の一部として扱う（消す・意味を変えるときは API のメジャーを上げる）。

**版の互換性**: API の版は「メジャー.マイナー」。プラグインの `apiVersion` のメジャーがアプリと同じで、マイナーがアプリ以下なら読み込める。
関数や欄を足しただけならマイナー、消した・意味を変えたならメジャーを上げる。

| 版 | 足したもの |
|---|---|
| 1.1 | 部品の見た目の約束（共通クラス `.button` / `.icon-button` と CSS 変数） |
| 1.2 | images/ の画像（`Model.images`、Msg の `ImagesAdded`、`imagePathOf` / `sha256Hex` / `imagePath` / `isImagePath`） |
| 1.3 | 受け取った画像のファイルを確かめる `checkImageFile` / `extensionOf`（画像の挿入のプラグインが、土台と同じ上限・同じ対応形式で断れるように） |
型の一覧は [src/plugin-api/index.ts](src/plugin-api/index.ts)。

読み込み: ツールバーのパズルのアイコン（プラグイン）→ ファイルのアイコン（ファイルから読み込む）か、URL を入れて → のアイコン
（URL の場合は、そのサーバーが CORS を許可している必要がある）。
