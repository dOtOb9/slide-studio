// PR の本文に「監査役のレビュー」の記録があるかを確かめる（PR #4 再発防止）。
//
// PR #4 では、監査役が auditor.md の形式のレビューをせずに PR を出し、本文に「承認しました」と書いてしまった。
// レビューの手順が文書にしか無く、飛ばしても何も止まらなかったのが原因。
// そこで、PR の本文にレビューの記録（自分で実行した検証結果と判定）が無ければ CI で落とす。
//
// - checkPrBody(body): 足りない項目の一覧（文字列の配列）を返す純粋な関数。空なら合格。
// - このファイルを node で直接実行すると、環境変数 PR_BODY の本文を検査し、足りなければ一覧を出して exit 1 する。
//   （.github/workflows/pr-review-record.yml から呼ぶ）
//
// 方針: 見出しの階層（## か ###）や空白の揺れには寛容に、中身の有無には厳しく。
// 中身が本当に正しいか（検証を本当に実行したか）までは確かめられない。確かめるのは「書く欄を空のまま出していないか」。

import { pathToFileURL } from 'node:url';

/** 検証結果として書く3つ。auditor.md「報告の形式」の `vitest: … / tsc: … / eslint: …` */
const TOOLS = ['vitest', 'tsc', 'eslint'];

/**
 * auditor.md の報告の見出し。レビューの節の中に `## 検証結果` のようにそのまま貼っても、
 * 節がそこで終わったことにしない（貼り付けた報告の階層が上がっていても許す）。
 */
const REPORT_SUBHEADINGS = ['検証結果', '指摘', '良い点', '判定'];

/** `## 見出し` を読む。見出しでなければ null。 */
function parseHeading(line) {
  const m = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
  return m ? { level: m[1].length, text: m[2] } : null;
}

/** 書いた中身が空・プレースホルダー（「…」「...」「-」など）だけなら true。 */
function isBlank(text) {
  return text.replace(/[\s…．.。・\-–—/|*_`~、,:：]/g, '') === '';
}

/**
 * 自分で実行した結果ではないことを示す語（audit-1 #2）。
 * PR #4 の原因の2つ目は「作業役の報告・CI の緑を自分の検証の代わりにした」こと。
 * 「CI を参照」「未実行」「省略」のような書き方は、欄が埋まっていても結果ではないので不合格にする。
 */
// CI は大文字の単語のときだけ（"precise" などの英単語の中の ci で落とさないため）。
const NOT_OWN_RESULT = /未実行|実行していない|省略|参照|同上|未確認|作業役|\bCI\b|TODO/;

/**
 * 「監査役のレビュー」の節の行を返す。無ければ null。
 * 節は見出しの次の行から、同じかそれより上の階層の見出しの手前まで（ただし REPORT_SUBHEADINGS の見出しは節に含める）。
 */
function findReviewSection(lines) {
  const start = lines.findIndex((line) => {
    const h = parseHeading(line);
    return h !== null && (h.level === 2 || h.level === 3) && h.text.includes('監査役のレビュー');
  });
  if (start === -1) return null;
  const level = parseHeading(lines[start]).level;
  const section = [];
  for (const line of lines.slice(start + 1)) {
    const h = parseHeading(line);
    if (h && h.level <= level && !REPORT_SUBHEADINGS.some((w) => h.text.includes(w))) break;
    section.push(line);
  }
  return section;
}

/**
 * 節の中で、ツール（vitest など）の後ろに中身が書かれているか。
 * 1行に `vitest: 120 passed / tsc: エラーなし / eslint: エラーなし` と並べても、行を分けてもよい。
 * 値は、次のツール名の手前までとする。
 */
function toolsWithResult(section) {
  const found = new Set();
  const key = /\b(vitest|tsc|eslint)\s*[:：]/g;
  for (const line of section) {
    const matches = [...line.matchAll(key)];
    matches.forEach((m, i) => {
      const end = i + 1 < matches.length ? matches[i + 1].index : line.length;
      const value = line.slice(m.index + m[0].length, end);
      if (!isBlank(value) && !NOT_OWN_RESULT.test(value)) found.add(m[1]);
    });
  }
  return found;
}

/**
 * 節の中の最後の「判定」の中身を返す。無ければ null。
 * - 見出し（`### 判定`）なら、次の見出しまでの行
 * - 行（`判定: 承認`）なら、その行の「判定」より後ろ。空なら次の空行・見出しまでの行
 */
function verdictText(section) {
  let index = -1;
  section.forEach((line, i) => {
    if (line.includes('判定')) index = i;
  });
  if (index === -1) return null;

  const rest = section.slice(index + 1);
  if (parseHeading(section[index])) {
    const end = rest.findIndex((line) => parseHeading(line) !== null);
    return (end === -1 ? rest : rest.slice(0, end)).join('\n');
  }
  const after = section[index].slice(section[index].lastIndexOf('判定') + '判定'.length);
  if (!isBlank(after)) return after;
  const end = rest.findIndex((line, i) => parseHeading(line) !== null || (line.trim() === '' && i > 0));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/**
 * PR の本文を検査し、足りない項目の一覧を返す。空の配列なら合格。
 * @param {string} body PR の本文（Markdown）
 * @returns {string[]}
 */
export function checkPrBody(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const section = findReviewSection(lines);
  if (section === null) {
    return ['「監査役のレビュー」を含む見出し（## か ###）がない'];
  }

  const problems = [];
  const found = toolsWithResult(section);
  for (const tool of TOOLS) {
    if (!found.has(tool)) {
      problems.push(`監査役のレビューの節に「${tool}: 」の検証結果がない（空や「…」だけ、「未実行」「CI を参照」「省略」なども不可。自分で実行した結果を書く）`);
    }
  }

  const verdict = verdictText(section);
  if (verdict === null) {
    problems.push('監査役のレビューの節に「判定」がない');
  } else if (verdict.includes('差し戻し')) {
    // 「承認（差し戻しなし）」も落ちる。経緯は判定の欄ではなく「やり取りの要約」に書いてもらう（audit-1 #4）
    problems.push('判定の欄に「差し戻し」の語がある（承認なら判定の欄には「承認」とだけ書き、往復の経緯は「やり取りの要約」へ。承認されていない PR は Draft で出す）');
  } else if (!/(?<![未非不])承認/.test(verdict)) {
    problems.push('判定に「承認」がない');
  }
  return problems;
}

// node scripts/check-pr-body.mjs として直接実行されたときだけ動く（テストから import したときは動かない）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkPrBody(process.env.PR_BODY ?? '');
  if (problems.length > 0) {
    console.error('PR の本文に監査役のレビューの記録が足りない（AGENTS.md「PR の本文」）:');
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  console.log('PR の本文に監査役のレビューの記録がある。');
}
