// 外部プラグインの読み込み（Elm でいう Cmd: 外の世界との非同期のやり取り）。
// .js のモジュールを import() で読み、plugins/host.ts に登録する。
//
// 注意: 読み込んだコードはアプリと同じ権限で動く（ページの中のものに何でも触れる）。
// 信頼できるプラグインだけを入れること。プラグインは TEA の形（Msg → update → Model）なので、
// 将来は Worker や iframe に閉じ込めやすい。
//
// プラグインのファイルは1ファイルで完結させる（ファイルから読むときは、中の相対パスの import が解決できないため）。

import { api } from '../plugin-api';
import { pluginFromModule, registerPlugin } from '../plugins/host';

/** 失敗の理由を知らせる（io/commands.ts と同じ形） */
const report = (e: unknown) =>
  window.alert(`プラグインを読み込めませんでした: ${e instanceof Error ? e.message : String(e)}`);

/** モジュールを読み込んで登録する。登録できたらプラグイン名、失敗したら null */
async function load(url: string): Promise<string | null> {
  try {
    // @vite-ignore: 中身が実行時に決まる import なので、Vite に「解決しようとしなくてよい」と伝える
    const mod: unknown = await import(/* @vite-ignore */ url);
    return registerPlugin(pluginFromModule(mod, api), 'external').name;
  } catch (e) {
    report(e);
    return null;
  }
}

/** URL（https://… の .js）から読み込む */
export function loadPluginFromUrl(url: string): Promise<string | null> {
  return load(url.trim());
}

/** ファイルを選んで読み込む。キャンセルされたら null */
export async function loadPluginFromFile(): Promise<string | null> {
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js,.mjs';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return null;
  // ファイルの中身から一時的な URL を作り、それを import() する
  const url = URL.createObjectURL(new Blob([await file.text()], { type: 'text/javascript' }));
  try {
    return await load(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
