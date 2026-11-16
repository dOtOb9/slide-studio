// プラグインの一覧（view）。ツールバーの「プラグイン」ボタンで開く。
// 有効・無効の切り替え、外部プラグインの読み込み（ファイル・URL）と取り外しができる。
//
// プラグインの登録簿は Model ではなく plugins/host.ts にあり（関数を持ち、保存も元に戻すもしないため）、
// 切り替えは host の関数を直接呼ぶ。ファイルの読み書きを io/ の手順で直接呼ぶのと同じ扱い。
// パネルの開閉と URL の入力途中の文字は、見た目だけの一時状態なので、この部品の中に持つ。

import { useState } from 'react';
import { usePlugins } from '../hooks/usePlugins';
import { loadPluginFromFile, loadPluginFromUrl } from '../io/plugins';
import { API_VERSION } from '../plugin-api';
import { setPluginEnabled, unregisterPlugin } from '../plugins/host';

export function PluginManager() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const plugins = usePlugins();

  return (
    <div className="plugin-manager">
      <button className="button" onClick={() => setOpen(!open)} aria-expanded={open} title="プラグインの一覧">
        🧩 プラグイン
      </button>
      {open && (
        <div className="plugin-panel" role="dialog" aria-label="プラグイン">
          <div className="plugin-panel-head">
            <strong>プラグイン</strong>
            <span className="plugin-muted">API {API_VERSION}</span>
            <button className="plugin-close" onClick={() => setOpen(false)} title="閉じる">
              ×
            </button>
          </div>

          <ul className="plugin-list">
            {plugins.map(({ plugin, source, enabled }) => (
              <li key={plugin.name}>
                <label>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setPluginEnabled(plugin.name, e.target.checked)}
                  />
                  <span>
                    {plugin.title ?? plugin.name}
                    <span className="plugin-muted">
                      {' '}
                      {plugin.name} · {source === 'builtin' ? '同梱' : '外部'}
                    </span>
                    {plugin.description && <span className="plugin-description">{plugin.description}</span>}
                  </span>
                </label>
                {/* 同梱のプラグインは取り外さない（無効にはできる） */}
                {source === 'external' && (
                  <button className="button" onClick={() => unregisterPlugin(plugin.name)} title="一覧から取り除く">
                    取り除く
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="plugin-load">
            <button className="button" onClick={() => void loadPluginFromFile()}>
              ファイルから読み込む…
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault(); // ページの再読み込みを止める
                if (url.trim()) void loadPluginFromUrl(url).then((name) => name && setUrl(''));
              }}
            >
              {/* type="text": キー操作の監視（useKeyboard）が「文字の入力欄」として扱い、ショートカットを効かせない */}
              <input
                type="text"
                inputMode="url"
                placeholder="https://…/plugin.js"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button className="button" type="submit" disabled={!url.trim()}>
                URL から読み込む
              </button>
            </form>
          </div>

          <p className="plugin-warning">
            外部のプラグインはアプリと同じ権限で動きます。信頼できるものだけを読み込んでください。
            読み込んだプラグインは、ページを開き直すと外れます。
          </p>
        </div>
      )}
    </div>
  );
}
