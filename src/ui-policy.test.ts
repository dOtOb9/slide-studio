// UI の方針（AGENTS.md「UI の方針」）を、CSS と部品のソースを読んで機械的に確かめるテスト。
// Step 7b の監査指摘の再発防止:
//   #1 場所ごとに共通クラス（.button / .icon-button）の背景を上書きし、詳細度や順番で hover の色が消えた
//   #2 共通の部品（IconButton）を使わずに、アイコンのボタンを手で書いた
//   #4 色を :root の変数にせず、値を直接書いた
// 加えて、方針の中心である「境界を線（border）で作らない」も確かめる。
//
// 対象は src の下のすべての .css（index.css と、プラグインの style.css）。
// 例外として線を使うときは、その宣言の行に「/* 線の例外: 理由 */」と書く（選択枠のハンドルなど）。

import { describe, expect, it } from 'vitest';

// ソースは Vite の ?raw で読む（node:fs を使うと @types/node が要り、アプリのコードからも Node の型が見えてしまう）。
// vitest は CSS を既定で空にするので、vite.config.ts の test.css.include で「?raw の CSS」だけ生のまま通している。
const cssFiles = import.meta.glob<string>('./**/*.css', { query: '?raw', import: 'default', eager: true });
const componentFiles = import.meta.glob<string>('./components/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

interface Rule {
  file: string;
  selectors: string[];
  body: string;
}

/** セレクタの並びを、括弧の外の「,」だけで分ける（`:where(.a, .b) .button` は1つのセレクタ） */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  out.push(list.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** CSS を「セレクタ { 中身 }」の並びに分ける（入れ子の @media などは今は使っていないので扱わない） */
function parseRules(file: string, css: string): Rule[] {
  const rules: Rule[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = splitSelectors(m[1].replace(/\/\*[\s\S]*?\*\//g, ''));
    rules.push({ file, selectors, body: m[2] });
  }
  return rules;
}

const rules = Object.entries(cssFiles).flatMap(([file, css]) => parseRules(file, css));
const withoutComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

it('確かめる CSS が見つかっている（glob の書き間違いで素通りしないように）', () => {
  expect(Object.keys(cssFiles)).toContain('./index.css');
  expect(rules.length).toBeGreaterThan(20);
  expect(Object.keys(componentFiles)).toContain('./components/IconButton.tsx');
});

it('セレクタは括弧の外の「,」だけで分ける', () => {
  expect(splitSelectors(':where(.group, .plugin-panel) .button, .a[data-x="1,2"]')).toEqual([
    ':where(.group, .plugin-panel) .button',
    '.a[data-x="1,2"]',
  ]);
});

describe('UI の方針', () => {
  it('色は :root の変数にまとめ、ほかの場所に値を直接書かない（Step 7b audit-1 #4）', () => {
    const literal = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/i;
    const bad = rules
      .filter((r) => !r.selectors.includes(':root'))
      .filter((r) => literal.test(withoutComments(r.body)))
      .map((r) => `${r.file} ${r.selectors.join(', ')}`);
    expect(bad).toEqual([]);
  });

  it('境界を線（border）で作らない。例外は宣言の行に「線の例外: 理由」と書く', () => {
    const bad: string[] = [];
    for (const r of rules) {
      for (const line of r.body.split('\n')) {
        if (line.includes('線の例外:')) continue;
        for (const m of withoutComments(line).matchAll(/\bborder(-top|-right|-bottom|-left)?\s*:\s*([^;]+)/g)) {
          const value = m[2].trim();
          if (value === 'none' || value === '0') continue;
          bad.push(`${r.file} ${r.selectors.join(', ')} → border${m[1] ?? ''}: ${value}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('共通クラス（.button / .icon-button）の背景を場所ごとに上書きするときは :where() で詳細度を上げない（Step 7b audit-1 #1）', () => {
    // 詳細度の高い上書きは、後から書いた hover・無効・押下中の色を消してしまう。
    // 許すのは: クラス単体（共通の見た目）、状態のルール（:hover / :disabled / [aria-…]）、:where() で包んだもの
    const ok = (sel: string) =>
      /^\.(icon-)?button$/.test(sel) || /:hover|:disabled|\[aria-/.test(sel) || sel.startsWith(':where(');
    const bad = rules
      .filter((r) => /\bbackground\b/.test(withoutComments(r.body)))
      .flatMap((r) => r.selectors.map((sel) => ({ file: r.file, sel })))
      .filter(({ sel }) => /\.(icon-)?button\b/.test(sel) && !ok(sel))
      .map(({ file, sel }) => `${file} ${sel}`);
    expect(bad).toEqual([]);
  });

  it('アプリの部品（components/）のアイコンボタンは IconButton を使う（Step 7b audit-1 #2）', () => {
    // プラグインは components/ を import できないので、プラグインの部品は対象外（.icon-button を直接使う）
    const bad = Object.entries(componentFiles)
      .filter(([file]) => !file.endsWith('/IconButton.tsx'))
      // <button> に icon-button を直接付けていないか（＋の <span class="icon-button select-button"> はボタンではないので対象外）
      // 属性の中の「=>」（onClick={() => …}）でタグが終わったと見なさないよう、「=>」は読み飛ばす
      .filter(([, src]) => /<button\b(?:=>|[^>])*?className=["'][^"']*\bicon-button\b/.test(src))
      .map(([file]) => file);
    expect(bad).toEqual([]);
  });
});
