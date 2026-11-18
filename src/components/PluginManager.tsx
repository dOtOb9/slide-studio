import { ArrowRight, FileUp, Puzzle, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { TEXT_INPUT_TYPE_WHERE_SHORTCUTS_ARE_OFF } from '../hooks/useKeyboard';
import { usePlugins } from '../hooks/usePlugins';
import { loadPluginFromFile, loadPluginFromUrl } from '../io/plugins';
import { API_VERSION } from '../plugin-api';
import { setPluginEnabled, unregisterPlugin } from '../plugins/host';
import { IconButton } from './IconButton';

function stayOnPageInsteadOfReloading(e: FormEvent) {
  e.preventDefault();
}

export function PluginManager() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const plugins = usePlugins();

  return (
    <div className="plugin-manager">
      <IconButton label="プラグイン" expanded={open} onClick={() => setOpen(!open)}>
        <Puzzle />
      </IconButton>
      {open && (
        <div className="plugin-panel" role="dialog" aria-label="プラグイン">
          <div className="plugin-panel-head">
            <strong>プラグイン</strong>
            <span className="plugin-muted">API {API_VERSION}</span>
            <IconButton label="閉じる" onClick={() => setOpen(false)}>
              <X />
            </IconButton>
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
                {source === 'external' && (
                  <IconButton label={`${plugin.title ?? plugin.name} を取り除く`} onClick={() => unregisterPlugin(plugin.name)}>
                    <Trash2 />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>

          <div className="plugin-load">
            <IconButton label="ファイルから読み込む" onClick={() => void loadPluginFromFile()}>
              <FileUp />
            </IconButton>
            <form
              onSubmit={(e) => {
                stayOnPageInsteadOfReloading(e);
                if (url.trim()) void loadPluginFromUrl(url).then((name) => name && setUrl(''));
              }}
            >
              <input
                type={TEXT_INPUT_TYPE_WHERE_SHORTCUTS_ARE_OFF}
                inputMode="url"
                placeholder="URL から読み込む（https://…/plugin.js）"
                aria-label="プラグインの URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <IconButton type="submit" label="URL から読み込む" disabled={!url.trim()}>
                <ArrowRight />
              </IconButton>
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
