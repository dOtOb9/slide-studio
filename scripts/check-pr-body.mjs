import { pathToFileURL } from 'node:url';

const TOOLS = ['vitest', 'tsc', 'eslint'];

const PASTED_AUDITOR_REPORT_HEADINGS_STAY_INSIDE_SECTION = ['検証結果', '指摘', '良い点', '判定'];

function parseHeading(line) {
  const m = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
  return m ? { level: m[1].length, text: m[2] } : null;
}

function isBlankOrPlaceholder(text) {
  return text.replace(/[\s…．.。・\-–—/|*_`~、,:：]/g, '') === '';
}

function hideHtmlCommentsLikeGitHubKeepingLineCount(text) {
  return text.replace(/<!--[\s\S]*?(?:-->|$)/g, (comment) => comment.replace(/[^\n]/g, ''));
}

function blankOutCodeBlocksSinceTheyReadAsQuotes(lines) {
  let openFence = null;
  return lines.map((line) => {
    if (openFence === null) {
      const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (open) openFence = open[1];
      return open ? '' : line;
    }
    const close = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(line);
    if (close && close[1][0] === openFence[0] && close[1].length >= openFence.length) openFence = null;
    return '';
  });
}

const CI_ONLY_AS_UPPERCASE_WORD_NOT_INSIDE_PRECISE = /\bCI\b/;
const NOT_A_RESULT_YOU_RAN_YOURSELF = new RegExp(
  `未実行|実行していない|省略|参照|同上|未確認|作業役|${CI_ONLY_AS_UPPERCASE_WORD_NOT_INSIDE_PRECISE.source}|TODO`,
);

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
    if (h && h.level <= level && !PASTED_AUDITOR_REPORT_HEADINGS_STAY_INSIDE_SECTION.some((w) => h.text.includes(w))) break;
    section.push(line);
  }
  return section;
}

function toolsWithResult(section) {
  const found = new Set();
  const key = /\b(vitest|tsc|eslint)\s*[:：]/g;
  for (const line of section) {
    const matches = [...line.matchAll(key)];
    matches.forEach((m, i) => {
      const end = i + 1 < matches.length ? matches[i + 1].index : line.length;
      const value = line.slice(m.index + m[0].length, end);
      if (!isBlankOrPlaceholder(value) && !NOT_A_RESULT_YOU_RAN_YOURSELF.test(value)) found.add(m[1]);
    });
  }
  return found;
}

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
  if (!isBlankOrPlaceholder(after)) return after;
  const end = rest.findIndex((line, i) => parseHeading(line) !== null || (line.trim() === '' && i > 0));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

function verdictWithoutSpacesAndSymbols(verdict) {
  return verdict.replace(/[\s\p{P}\p{S}]/gu, '');
}

export function checkPrBody(body) {
  const lines = blankOutCodeBlocksSinceTheyReadAsQuotes(hideHtmlCommentsLikeGitHubKeepingLineCount(String(body ?? '')).split(/\r?\n/));
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
    problems.push('判定の欄に「差し戻し」の語がある（承認なら判定の欄には「承認」とだけ書き、往復の経緯は「やり取りの要約」へ。承認されていない PR は Draft で出す）');
  } else if (verdictWithoutSpacesAndSymbols(verdict) !== '承認') {
    problems.push('判定が「承認」になっていない（判定の欄には「承認」とだけ書く）');
  }
  return problems;
}

const runDirectlyByNodeNotImportedByTest = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runDirectlyByNodeNotImportedByTest) {
  const problems = checkPrBody(process.env.PR_BODY ?? '');
  if (problems.length > 0) {
    console.error('PR の本文に監査役のレビューの記録が足りない（AGENTS.md「PR の本文」）:');
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  console.log('PR の本文に監査役のレビューの記録がある。');
}
