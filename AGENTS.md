# AGENTS.md

AI エージェント（Claude Code ほか）がこのリポジトリで作業するときの指示書。

## プロジェクト

HTML を正本にした、PowerPoint のように GUI で編集できるスライドエディタ。
- 他の人に配布する前提。共同編集は対象外。AI 連携は「外部の AI が deck.html を直接編集できる」まで。
- **オーナーは React の基礎を学びながら進めている。** コードは AI が書き、オーナーが読んで理解する。
  → 賢い抽象化より、読んで追える素直なコードを優先する。設計意図は日本語のコメントで残す。

## コマンド

```
npm run dev          # 開発サーバー
npx vitest run       # 単体テスト
npx tsc -b           # 型チェック
npx eslint src       # lint
```

作業の区切りでは、上の3つ（vitest / tsc / eslint）がすべて通っていること。

**Windows の注意**: Git Bash で `cd /c/workspace/slide-studio` の形で移動して vitest を実行すると、
全テストが `Cannot read properties of undefined (reading 'config')` で失敗する（コードの問題ではない）。
PowerShell から実行するか、Git Bash なら `cd C:/workspace/slide-studio` の形で移動してから実行する。
GUI の挙動を変えたときは、実ブラウザでも確認する（後述）。

## アーキテクチャの約束

Elm の TEA（The Elm Architecture）に沿う。

```
            ┌──────── Msg ◀──── view（components/）・Sub（hooks/）
            ▼
update(model, msg) ─▶ Model ─▶ view が描画 ─▶ SlideView が renderSlideHtml で Shadow DOM に描く
  （app/update.ts）    （app/model.ts）

deck.html ─parse─▶ Deck（Model の一部）─serialize─▶ deck.html
```

| 層 | 置き場所 | 中身 |
|---|---|---|
| Model | `app/model.ts` | 保存するもの（Deck）、履歴、操作の状態（選択・ドラッグ・編集）、測った要素位置 |
| Msg | `app/msg.ts` | 起こりうる出来事の一覧（判別可能な共用体） |
| update | `app/update.ts` | `(Model, Msg) → Model` の純粋関数。履歴の積み方もここ |
| ランタイム | `app/store.ts` | Model を持ち `dispatch(msg)` を受けるだけ。ロジックを書かない |
| view | `components/` | Model を読んで描画し、Msg を送るだけ |
| Sub | `hooks/` | DOM の出来事（キー、描画後の位置測定、テキスト確定）を Msg に変える |
| Cmd | `io/` | ファイルの読み書きなど外の世界との非同期処理。Model は変えず、終わった結果を Msg で送る |
| ドメイン | `model/` | ファイル形式（parse / serialize / render）と Deck の編集・幾何計算 |
| 機能 | `features/<名前>/` | 個々の機能の Msg・update・ツールバー部品。`features/registry.ts` に登録する（下記） |
| 共通の道具 | `app/helpers.ts` | `edit`（履歴に積む）、`withNewIds`、`currentSlide`、`isBusy` など。update と各機能が使う |

1. **`src/model/` と `src/app/` は React に依存しない純粋な TypeScript。** ロジックはここに置き、単体テストを書く。`update` は Msg を順に流すだけでテストできる。
2. **状態を変える唯一の入口は `dispatch(msg)`。** 新しい操作は「Msg を足す → update に case を足す → view から送る」の順で作る。update の `switch` は網羅チェック（`assertNever`）付きなので、扱い忘れは型エラーになる。
3. **view に判断を書かない。** 「選択中なら〜」のような分岐は update に置く。view が持ってよいのは、見た目だけの一時状態（画面サイズ、hover）と DOM への参照だけ。
4. **Deck は書き換えずに新しく作る（イミュータブル）。** 編集は `model/commands.ts` の関数で行う。変更していないスライドは同じオブジェクトのまま共有されるので、履歴は古い Deck を取っておくだけで作れ、「どのスライドが変わったか」も参照の比較でわかる。
5. **履歴は「ユーザーの1操作 = 1件」。** ドラッグは `DragStarted` 〜 `DragEnded` で1件。Deck を変える Msg を足すときは、update 内で `edit()`（即1件積む）を使うか、ジェスチャーとしてまとめるかを決める。
6. **例外: テキスト編集中の文字は DOM（contentEditable）が持つ。** 確定時に `TextCommitted` を送る。
   同様に、開いているファイルのハンドル（上書き保存の宛先）は `io/file.ts` が持つ（Model に入れられない外部資源のため）。
7. **新しい id は update が Model の連番（`nextId`）から作る。** model/commands の関数には id を作る関数を引数で渡す。乱数や時刻を使わないので、テストで結果を予測できる。
8. **「何も変わらない」ときは元の Deck をそのまま返す。** 未保存の判定（`deck !== savedDeck`）や空の履歴の防止は、この参照比較に頼っている。
9. **スライドの見た目は `renderSlideHtml` だけが作る。** 画面・サムネイル・書き出しで同じ関数を使い、見た目を一致させる。編集画面だけの表示（空のプレースホルダーの案内など）はプロキシ側に出し、スライド本体には混ぜない。
10. **読み込み→書き出し→読み込み で内容が変わらないこと**（ラウンドトリップ）。ファイル形式に触れる変更では必ずテストする。
11. ライブラリは「自前で書くと難しく、かつ TEA の流れを壊さないもの」に限る（例: react-moveable は対象要素を自分で書き換える前提で相性が悪く、Step 2 で外した）。

ファイル形式の仕様は README.md を参照。

## 機能の足し方（features/）

新しい機能（図形、書式、整列、書き出しなど）は、土台（`app/`・`components/`）を触らずに `src/features/<名前>/` に作る。
並列で複数のエージェントが作業しても、触るファイルが重ならないようにするため。例は `features/shapes/`。

1. **Msg を決める。** type は必ず `"<名前>/<出来事>"`（例: `'shapes/Inserted'`）。土台の Msg と区別するため `/` を含める。
2. **update を書く。** `(Model, あなたの Msg) → Model` の純粋関数。Deck を変えるなら `app/helpers.ts` の `edit()` を通す（履歴に1件積まれ、未保存の判定も正しくなる）。新しい id は `withNewIds()` で作り、返す Model の `nextId` を更新する。ドラッグ中・編集中に Deck を変えないよう `isBusy()` を確認する。Deck の変更自体は `model/commands.ts` の関数で行い、足りない関数は追加してよい（テストも書く）。
3. **必要なら UI を書く。** `ToolbarSection`（ツールバーに並ぶ部品）。部品は Model を読み、Msg を送るだけにする。キー操作は `onKey`（土台が扱わなかったキーだけが回ってくる）。
4. **`index.ts` で `Feature` としてまとめ、`features/registry.ts` の2か所に1行ずつ足す**（`FeatureMsg` の型と `features` の配列）。
5. **テストを書く。** `features/<名前>/*.test.ts`。土台の `update` に Msg を流せば registry 経由で届くので、`update(model, { type: '<名前>/...' })` でテストできる。

土台の変更がどうしても必要なとき（Model に欄を足す、新しいファイル形式を足す、など）は、その機能の作業とは別のコミットにし、理由を書く。
ファイル形式を足すときは README の「ファイル形式」を更新し、ラウンドトリップのテストを書く。

## ブラウザでの動作確認

Playwright はプロジェクトに入れていない。一時ディレクトリに `playwright-core` を入れ、
Edge をデバッグポート付きで起動して `chromium.connectOverCDP('http://127.0.0.1:9333')` で接続する
（`chromium.launch({ channel: 'msedge' })` はこの環境では起動に失敗する）。

```
msedge --headless=new --remote-debugging-port=9333 --user-data-dir=<一時ディレクトリ> about:blank
```

## 作業ループ（実装 → 監査 → 反映）

各ステップ（まとまった変更）は次のループで進める。
**役割分担: 監査役はレビューだけ（編集しない）。コードを直すのは常に作業エージェント。**

```
実装 ─▶ 監査（初回: まっさら） ─▶ 判定 ─承認─▶ 報告・コミット
          ▲                        │
          │                      差し戻し
          └── 再レビュー ◀── 作業エージェントが修正
              （同じ監査役）
```

1. **実装**: 作業エージェントが変更を書き、vitest / tsc / eslint とブラウザ確認を通す。
2. **初回監査**: まっさらなコンテキストの監査役を起動する。
   - Claude Code: Agent ツールで `subagent_type: "auditor"`（定義は `.claude/agents/auditor.md`）。
     その種類が使えないときは general-purpose エージェントに「`.claude/agents/auditor.md` を読んでその指示に従え」と渡す。
   - 先にステップの実装をコミットしておく（下記「コミットの分け方」）。
   - 渡すもの: このステップの目的、確認すべきコミットの範囲（例: `git diff 789b761..HEAD`）。実装中の経緯や言い訳は渡さない。
   - 監査役は報告の最後に **判定（承認 / 差し戻し）** を書く。
3. **修正**: 差し戻しなら、作業エージェントが指摘を1件ずつ判断する。
   - 採用するものは直す。採用しないものは理由を書く。
   - 直したら vitest / tsc / eslint（とブラウザ確認）を通す。
4. **再レビュー**: **同じ監査役**に（SendMessage で）差し戻す。渡すのは「指摘番号ごとの対応（修正内容 or 不採用の理由）」だけ。
   監査役は修正を確認し、不採用の理由に納得できるかを判断し、修正で新たに生じた問題があれば指摘して、再び判定を出す。
5. 承認が出るまで 3〜4 を繰り返す。**最大3往復。** それでも承認されなければ、残った論点を両者の言い分付きでオーナーに上げて判断を仰ぐ。
6. **報告**: オーナーに「何を作ったか」「監査の指摘と、その対応」「何往復で承認されたか」を短くまとめて伝える。
7. **コミット**: 下記「コミットの分け方」に従い、承認後に GitHub（origin/main）へ push する。

## コミットの分け方

1つのステップを1コミットにまとめず、**意味のある単位ごとに分ける**。履歴を読めば「何を作り、監査で何を直したか」が追えるようにする。

- 機能の実装: 独立して説明できる単位ごとに1コミット（例: モデルの関数とテスト / それを使う UI）。
- 監査での修正: 指摘への対応は実装とは**別のコミット**にし、どの指摘への対応かを書く。
- 開発プロセスや文書だけの変更（AGENTS.md など）は、コードと混ぜずに別コミット。
- 各コミットの時点で vitest / tsc / eslint が通ること。

メッセージの書き方:

```
Step N: 概要                     ← 機能の実装
Step N audit-K: 概要（指摘#1,#3） ← K 往復目の監査指摘への対応
docs: 概要                       ← 文書・プロセスのみ
```

**注意**: 監査役は `git diff HEAD` などで差分を読んでいる。監査中にコミットすると、監査役が見ている差分が変わってしまう。
初回監査に出す前にステップの実装をコミットしておき、監査役には `git diff <監査前のコミット>..HEAD` のようにコミットの範囲で渡す。
