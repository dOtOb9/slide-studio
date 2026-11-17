import { api } from '../plugin-api';
import { pluginFromModule, registerPlugin } from '../plugins/host';

const report = (e: unknown) =>
  window.alert(`プラグインを読み込めませんでした: ${e instanceof Error ? e.message : String(e)}`);

async function load(url: string): Promise<string | null> {
  try {
    const mod: unknown = await import(/* @vite-ignore */ url);
    return registerPlugin(pluginFromModule(mod, api), 'external').name;
  } catch (e) {
    report(e);
    return null;
  }
}

export function loadPluginFromUrl(url: string): Promise<string | null> {
  return load(url.trim());
}

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
  const url = URL.createObjectURL(new Blob([await file.text()], { type: 'text/javascript' }));
  try {
    return await load(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
