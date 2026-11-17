import { describe, expect, it } from 'vitest';
import { checkPrBody } from './check-pr-body.mjs';

// AGENTS.md「PR の本文」の型どおりに書いた本文
const GOOD = `## 受け入れ条件
- [x] npm audit の指摘がなくなる

## 実装の説明
lockfile だけを更新した。

## 監査役のレビュー
### 検証結果
vitest: 152 passed / tsc: エラーなし / eslint: エラーなし

### 指摘
指摘なし

### 判定
承認

## やり取りの要約
差し戻しなし。

## 残件
なし
`;

/** GOOD の一部を置き換えた本文 */
const replaced = (from, to) => {
  expect(GOOD).toContain(from); // 置き換え元を書き間違えたら、テストが何も試さずに通ってしまうので確かめる
  return GOOD.replace(from, to);
};

describe('checkPrBody', () => {
  it('型どおりの本文は合格', () => {
    expect(checkPrBody(GOOD)).toEqual([]);
  });

  it('改行が CRLF でも、見出しが ### でも、検証結果が行ごとでも合格', () => {
    const body = [
      '### 監査役のレビュー',
      '#### 検証結果',
      '- vitest：152 passed',
      '- tsc: エラーなし',
      '- eslint: エラーなし',
      '',
      '**判定**: 承認',
    ].join('\r\n');
    expect(checkPrBody(body)).toEqual([]);
  });

  it('auditor.md の報告を ## のまま貼っても、節が途切れず合格', () => {
    const body = `## 監査役のレビュー（2往復目）
## 検証結果
vitest: 152 passed / tsc: エラーなし / eslint: エラーなし

## 指摘
指摘なし

## 判定
承認

## 残件
なし
`;
    expect(checkPrBody(body)).toEqual([]);
  });

  it('見出しが無ければ不合格', () => {
    const problems = checkPrBody(replaced('## 監査役のレビュー', '## レビュー'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('見出し');
  });

  it('見出しでなく本文の中に「監査役のレビュー」と書いただけでは不合格', () => {
    expect(checkPrBody(replaced('## 監査役のレビュー', '監査役のレビュー'))).not.toEqual([]);
  });

  it('空の本文は不合格', () => {
    expect(checkPrBody('')).not.toEqual([]);
  });

  it('検証結果の1つが欠けると、その1つだけを挙げる', () => {
    const problems = checkPrBody(replaced(' / tsc: エラーなし', ''));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('tsc');
  });

  it.each([
    ['空', 'vitest: / tsc: エラーなし / eslint: エラーなし'],
    ['「…」だけ', 'vitest: … / tsc: エラーなし / eslint: エラーなし'],
    ['「...」だけ', 'vitest: ... / tsc: エラーなし / eslint: エラーなし'],
    ['行末で空', 'tsc: エラーなし / eslint: エラーなし / vitest:'],
  ])('検証結果が%sなら不合格', (_, line) => {
    const problems = checkPrBody(replaced('vitest: 152 passed / tsc: エラーなし / eslint: エラーなし', line));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('vitest');
  });

  // audit-1 #2: 欄が埋まっていても、自分で実行した結果でない書き方は不合格
  it.each([
    ['未実行'],
    ['CI を参照'],
    ['CI と同じ'],
    ['省略'],
    ['作業役の報告どおり'],
    ['同上'],
    ['未確認'],
    ['TODO'],
  ])('検証結果が「%s」なら不合格', (value) => {
    const problems = checkPrBody(replaced('vitest: 152 passed', `vitest: ${value}`));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('vitest');
  });

  it('英単語の中の ci（precise など）では落とさない', () => {
    expect(checkPrBody(replaced('vitest: 152 passed', 'vitest: 152 passed (precise)'))).toEqual([]);
  });

  it('auditor.md の型をそのまま写した（全部「…」）なら3つとも挙げる', () => {
    const problems = checkPrBody(replaced('vitest: 152 passed / tsc: エラーなし / eslint: エラーなし', 'vitest: … / tsc: … / eslint: …'));
    expect(problems).toHaveLength(3);
  });

  it('判定が差し戻しなら不合格', () => {
    const problems = checkPrBody(replaced('### 判定\n承認', '### 判定\n差し戻し（#1 が未解決）'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('差し戻し');
  });

  it('「承認（差し戻しなし）」も不合格で、判定の欄に「差し戻し」を書かないよう案内する', () => {
    const problems = checkPrBody(replaced('### 判定\n承認', '### 判定\n承認（差し戻しなし）'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('「承認」とだけ書き');
  });

  it('判定を型のまま「承認 | 差し戻し」にしたなら不合格', () => {
    expect(checkPrBody(replaced('### 判定\n承認', '### 判定\n承認 | 差し戻し'))).toHaveLength(1);
  });

  // PR #5 pr-audit-1 #2: 判定は「承認」の語そのものだけ。前にも後ろにも否定や語が付けば落ちる
  it.each([['未承認'], ['承認しない'], ['承認できない'], ['承認待ち'], ['承認しました（未検証）']])('判定が「%s」なら不合格', (value) => {
    const problems = checkPrBody(replaced('### 判定\n承認', `### 判定\n${value}`));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('「承認」とだけ書く');
  });

  it.each([['承認。'], ['**承認**'], ['「承認」']])('判定が「%s」（記号の揺れだけ）なら合格', (value) => {
    expect(checkPrBody(replaced('### 判定\n承認', `### 判定\n${value}`))).toEqual([]);
  });

  it('判定の見出しの下が空なら不合格', () => {
    expect(checkPrBody(replaced('### 判定\n承認', '### 判定\n'))).toHaveLength(1);
  });

  it('判定が無ければ不合格', () => {
    const problems = checkPrBody(replaced('### 判定\n承認\n', ''));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('判定');
  });

  it('判定が節の外（後ろの節）にだけあるなら不合格', () => {
    const body = replaced('### 判定\n承認\n', '').replace('## 残件\nなし', '## 残件\n判定: 承認');
    expect(checkPrBody(body)).toHaveLength(1);
  });

  it('検証結果がレビューの節の外にだけあるなら不合格', () => {
    const body = replaced('vitest: 152 passed / tsc: エラーなし / eslint: エラーなし', '（検証結果は作業役の報告を参照）')
      .replace('lockfile だけを更新した。', 'lockfile だけを更新した。\nvitest: 152 passed / tsc: エラーなし / eslint: エラーなし');
    expect(checkPrBody(body)).toHaveLength(3);
  });

  // audit-1 #5: コードブロックの中は数えない
  it('本文の前の方にコードブロックで型を引用していても、本物の節で合格', () => {
    const quote = '## 参考\n```markdown\n## 監査役のレビュー\nvitest: … / tsc: … / eslint: …\n### 判定\n承認 | 差し戻し\n```\n\n';
    expect(checkPrBody(quote + GOOD)).toEqual([]);
  });

  it('節の中身をコードブロックに入れただけでは数えない', () => {
    const body = '## 監査役のレビュー\n```\nvitest: 152 passed / tsc: エラーなし / eslint: エラーなし\n### 判定\n承認\n```\n';
    expect(checkPrBody(body)).toHaveLength(4);
  });

  // PR #5 pr-audit-1 #1: HTML コメントの中は画面に表示されないので数えない。ブロックは同じ記号でだけ閉じる
  it('HTML コメントの中にだけ節があるなら不合格', () => {
    const body = '## 概要\n承認しました\n<!--\n## 監査役のレビュー\nvitest: 1 passed / tsc: ok / eslint: ok\n判定: 承認\n-->';
    expect(checkPrBody(body)).toEqual(['「監査役のレビュー」を含む見出し（## か ###）がない']);
  });

  it('1行の中の HTML コメントに書いた検証結果は数えない', () => {
    const problems = checkPrBody(replaced('vitest: 152 passed / tsc', '<!-- vitest: 152 passed --> / tsc'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('vitest');
  });

  it('閉じていない HTML コメントは本文の最後までを隠す', () => {
    expect(checkPrBody(replaced('## 監査役のレビュー', '<!--\n## 監査役のレビュー'))).toHaveLength(1);
  });

  it('HTML コメントの後ろの本物の節は数える', () => {
    expect(checkPrBody('<!-- 型: ## 監査役のレビュー -->\n' + GOOD)).toEqual([]);
  });

  it('``` で開いたブロックの中の ~~~ ではブロックが閉じない', () => {
    const body = '## 監査役のレビュー\n```\n~~~\nvitest: 1 passed / tsc: ok / eslint: ok\n判定: 承認\n```';
    expect(checkPrBody(body)).toHaveLength(4);
  });

  it('```` で開いたブロックは ``` では閉じない（長さが足りない）', () => {
    const body = '## 監査役のレビュー\n````\n```\nvitest: 1 passed / tsc: ok / eslint: ok\n判定: 承認\n````';
    expect(checkPrBody(body)).toHaveLength(4);
  });

  it('PR #4 の本文のように「承認しました」とだけ書いたものは不合格', () => {
    const body = `## 概要
npm audit の指摘を直す。

## 監査役のレビュー
差し戻しなしで承認しました。
`;
    // 検証結果が3つとも無く、判定の行も無い
    expect(checkPrBody(body)).toHaveLength(4);
  });
});
