import { describe, expect, it } from 'vitest';

const cssFiles = import.meta.glob<string>('./**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

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

function splitSelectorsOnlyAtCommasOutsideParens(list: string): string[] {
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

function parseFlatRulesWithoutNestedAtRules(file: string, css: string): Rule[] {
  const rules: Rule[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ file, selectors: splitSelectorsOnlyAtCommasOutsideParens(m[1]), body: m[2] });
  }
  return rules;
}

const rules = Object.entries(cssFiles).flatMap(([file, css]) => parseFlatRulesWithoutNestedAtRules(file, css));

const BORDER_EXCEPTIONS: Record<string, string> = {
  './index.css .handle → border: 1.5px solid var(--accent)': 'キャンバス上の選択枠のハンドル（操作の対象を示す）',
};

function borderDeclarations(): string[] {
  const found: string[] = [];
  for (const r of rules) {
    for (const m of r.body.matchAll(/\bborder(-top|-right|-bottom|-left)?\s*:\s*([^;]+)/g)) {
      const value = m[2].trim();
      if (value === 'none' || value === '0') continue;
      found.push(`${r.file} ${r.selectors.join(', ')} → border${m[1] ?? ''}: ${value}`);
    }
  }
  return found;
}

const SKIP_ARROWS_INSIDE_ATTRIBUTES_SO_TAG_DOES_NOT_END_EARLY = String.raw`(?:=>|[^>])*?`;
const BUTTON_TAG_WITH_ICON_BUTTON_CLASS = new RegExp(
  String.raw`<button\b` +
    SKIP_ARROWS_INSIDE_ATTRIBUTES_SO_TAG_DOES_NOT_END_EARLY +
    String.raw`className=["'][^"']*\bicon-button\b`,
);

it('確かめる CSS が見つかっている（glob の書き間違いで素通りしないように。Vite の ?raw で読むので node:fs も Node の型も要らない）', () => {
  expect(Object.keys(cssFiles)).toContain('./index.css');
  expect(rules.length).toBeGreaterThan(20);
  expect(Object.keys(componentFiles)).toContain('./components/IconButton.tsx');
});

it('セレクタは括弧の外の「,」だけで分ける', () => {
  expect(splitSelectorsOnlyAtCommasOutsideParens(':where(.group, .plugin-panel) .button, .a[data-x="1,2"]')).toEqual([
    ':where(.group, .plugin-panel) .button',
    '.a[data-x="1,2"]',
  ]);
});

describe('UI の方針', () => {
  it('色は :root の変数にまとめ、ほかの場所に値を直接書かない（Step 7b audit-1 #4）', () => {
    const literal = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/i;
    const bad = rules
      .filter((r) => !r.selectors.includes(':root'))
      .filter((r) => literal.test(r.body))
      .map((r) => `${r.file} ${r.selectors.join(', ')}`);
    expect(bad).toEqual([]);
  });

  it('境界を線（border）で作らない。例外はこのテストの BORDER_EXCEPTIONS に、宣言1つごとに場所・値と理由を書く', () => {
    const bad = borderDeclarations().filter((declaration) => !(declaration in BORDER_EXCEPTIONS));
    expect(bad).toEqual([]);
  });

  it('BORDER_EXCEPTIONS には、いま実際に線を使っている場所だけを書く（線を消したら例外も消す）', () => {
    const used = new Set(borderDeclarations());
    expect(Object.keys(BORDER_EXCEPTIONS).filter((declaration) => !used.has(declaration))).toEqual([]);
  });

  it('共通クラス（.button / .icon-button）の背景を場所ごとに上書きするときは :where() で詳細度を上げない（詳細度の高い上書きは、後に書いた hover・無効・押下中の色を消す。Step 7b audit-1 #1）', () => {
    const classAloneOrStateRuleOrWrappedInWhere = (sel: string) =>
      /^\.(icon-)?button$/.test(sel) || /:hover|:disabled|\[aria-/.test(sel) || sel.startsWith(':where(');
    const bad = rules
      .filter((r) => /\bbackground\b/.test(r.body))
      .flatMap((r) => r.selectors.map((sel) => ({ file: r.file, sel })))
      .filter(({ sel }) => /\.(icon-)?button\b/.test(sel) && !classAloneOrStateRuleOrWrappedInWhere(sel))
      .map(({ file, sel }) => `${file} ${sel}`);
    expect(bad).toEqual([]);
  });

  it('アプリの部品（components/）のアイコンボタンは IconButton を使う（プラグインは components/ を import できないので対象外。Step 7b audit-1 #2）', () => {
    const bad = Object.entries(componentFiles)
      .filter(([file]) => !file.endsWith('/IconButton.tsx'))
      .filter(([, src]) => BUTTON_TAG_WITH_ICON_BUTTON_CLASS.test(src))
      .map(([file]) => file);
    expect(bad).toEqual([]);
  });

  it('IconButton の検査は、属性の中の「=>」でタグが終わったと見なさない（<span class="icon-button"> はボタンでないので対象外）', () => {
    expect(BUTTON_TAG_WITH_ICON_BUTTON_CLASS.test('<button onClick={() => go()} className="icon-button">')).toBe(true);
    expect(BUTTON_TAG_WITH_ICON_BUTTON_CLASS.test('<span className="icon-button select-button">')).toBe(false);
  });
});
