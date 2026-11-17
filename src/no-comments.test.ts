import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const scriptFiles = import.meta.glob<string>(
  ['/src/**/*.{ts,tsx}', '/examples/**/*.js', '/scripts/**/*.mjs', '/*.{ts,js}', '/tsconfig*.json'],
  { query: '?raw', import: 'default', eager: true },
);
const cssFiles = import.meta.glob<string>('/src/**/*.css', { query: '?raw', import: 'default', eager: true });
const htmlFiles = import.meta.glob<string>(['/src/**/*.html', '/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const workflowFilesInDotDirectory = import.meta.glob<string>('/.github/workflows/*.yml', {
  query: '?raw',
  import: 'default',
  eager: true,
  exhaustive: true,
});

const TOOL_DIRECTIVES_THAT_CHANGE_BEHAVIOR_OR_CHECKS = [
  /^\/\/\/\s*<reference\s[^>]*\/>$/,
  /^\/[/*]\s*eslint-(disable|enable)(-next-line|-line)?\b/,
  /^\/\/\s*@ts-(expect-error|ignore|nocheck)\b/,
  /^\/\*\s*@vite-ignore\s*\*\/$/,
];

const isToolDirective = (comment: string) =>
  TOOL_DIRECTIVES_THAT_CHANGE_BEHAVIOR_OR_CHECKS.some((directive) => directive.test(comment.trim()));

const LITERAL_KINDS_WHOSE_TEXT_IS_NOT_TRIVIA = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.RegularExpressionLiteral,
]);

function scriptKindOf(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.json')) return ts.ScriptKind.JSON;
  if (/\.m?js$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

const isJsDocNode = (node: ts.Node) =>
  node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode;

function realCommentsInScript(fileName: string, text: string): string[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false, scriptKindOf(fileName));
  const commentsByPos = new Map<number, ts.CommentRange>();
  const literalSpans: [number, number][] = [];
  const visit = (node: ts.Node) => {
    if (isJsDocNode(node)) return;
    if (node.kind === ts.SyntaxKind.JsxText) literalSpans.push([node.pos, node.end]);
    if (LITERAL_KINDS_WHOSE_TEXT_IS_NOT_TRIVIA.has(node.kind)) literalSpans.push([node.getStart(source), node.end]);
    for (const range of ts.getLeadingCommentRanges(text, node.pos) ?? []) commentsByPos.set(range.pos, range);
    for (const range of ts.getTrailingCommentRanges(text, node.end) ?? []) commentsByPos.set(range.pos, range);
    node.getChildren(source).forEach(visit);
  };
  visit(source);
  return [...commentsByPos.values()]
    .filter((range) => !literalSpans.some(([start, end]) => range.pos < end && range.end > start))
    .map((range) => text.slice(range.pos, range.end))
    .filter((comment) => !isToolDirective(comment));
}

const cssComments = (text: string) => text.match(/\/\*[\s\S]*?\*\//g) ?? [];
const htmlComments = (text: string) => text.match(/<!--[\s\S]*?-->/g) ?? [];
const yamlCommentLines = (text: string) => text.split('\n').filter((line) => /^\s*#/.test(line));

function commentsPerFile(files: Record<string, string>, find: (file: string, text: string) => string[]) {
  return Object.entries(files)
    .map(([file, text]) => ({ file, comments: find(file, text) }))
    .filter(({ comments }) => comments.length > 0);
}

describe('コードにコメントを書かない（意図は名前・型・関数の切り出し・テスト名で表す。AGENTS.md「コメントを書かない」）', () => {
  it('確かめるファイルが見つかっている（glob の書き間違いで素通りしないように）', () => {
    expect(Object.keys(scriptFiles)).toEqual(
      expect.arrayContaining([
        '/src/app/update.ts',
        '/src/components/Toolbar.tsx',
        '/src/vite-env.d.ts',
        '/examples/sticky-note/plugin.js',
        '/scripts/check-pr-body.mjs',
        '/vite.config.ts',
        '/eslint.config.js',
        '/tsconfig.app.json',
      ]),
    );
    expect(Object.keys(cssFiles)).toEqual(expect.arrayContaining(['/src/index.css', '/src/plugins/images/style.css']));
    expect(Object.keys(htmlFiles)).toEqual(expect.arrayContaining(['/index.html', '/src/samples/sample-deck.html']));
    expect(Object.keys(workflowFilesInDotDirectory)).toEqual(
      expect.arrayContaining(['.github/workflows/ci.yml', '.github/workflows/pr-review-record.yml']),
    );
  });

  it('TypeScript・JavaScript・tsconfig にコメントが無い（ツールへの指示だけは許す）', () => {
    expect(commentsPerFile(scriptFiles, realCommentsInScript)).toEqual([]);
  });

  it('CSS にコメントが無い', () => {
    expect(commentsPerFile(cssFiles, (_, text) => cssComments(text))).toEqual([]);
  });

  it('HTML にコメントが無い', () => {
    expect(commentsPerFile(htmlFiles, (_, text) => htmlComments(text))).toEqual([]);
  });

  it('GitHub Actions のワークフローにコメントの行が無い（説明は name: に書く）', () => {
    expect(commentsPerFile(workflowFilesInDotDirectory, (_, text) => yamlCommentLines(text))).toEqual([]);
  });
});

describe('コメントの見つけ方', () => {
  it('行コメント・ブロックコメント・JSDoc・行末のコメントを見つける', () => {
    const text = ['// a', '/* b */', '/** c */', 'export const x = 1; // d'].join('\n');
    expect(realCommentsInScript('x.ts', text)).toHaveLength(4);
  });

  it('JSX の {/* … */} を見つける', () => {
    expect(realCommentsInScript('x.tsx', 'export const v = <div>{/* x */}</div>;')).toEqual(['/* x */']);
  });

  it('文字列・テンプレート・正規表現・JSX の文字の中の // や /* は数えない', () => {
    const text = [
      "const a = 'https://example.com/*';",
      'const b = `// ${a} /* x */`;',
      'const c = /\\/\\*[\\s\\S]*?\\*\\//g;',
      'export const v = <a href="//x">// not a comment /* either */</a>;',
    ].join('\n');
    expect(realCommentsInScript('x.tsx', text)).toEqual([]);
  });

  it('ツールへの指示（reference・eslint-disable・@ts-expect-error・@vite-ignore）は許す', () => {
    const text = [
      '/// <reference types="vite/client" />',
      '// eslint-disable-next-line no-console',
      '// @ts-expect-error 外の型の誤り',
      'const m = import(/* @vite-ignore */ url);',
    ].join('\n');
    expect(realCommentsInScript('x.ts', text)).toEqual([]);
  });

  it('ツールへの指示に説明を足したものは許さない', () => {
    expect(realCommentsInScript('x.ts', '// @vite-ignore: 実行時に決まる import\nexport {};')).toHaveLength(1);
  });

  it('tsconfig（JSON にコメントを書ける形式）のコメントを見つける', () => {
    expect(realCommentsInScript('tsconfig.json', '{\n  /* Linting */\n  "strict": true\n}')).toEqual(['/* Linting */']);
  });

  it('CSS・HTML・YAML のコメントを見つける', () => {
    expect(cssComments('a { color: red; } /* x */')).toEqual(['/* x */']);
    expect(htmlComments('<p>a</p><!-- x -->')).toEqual(['<!-- x -->']);
    expect(yamlCommentLines('on: push\n  # x\nrun: echo "#1"')).toEqual(['  # x']);
  });
});
