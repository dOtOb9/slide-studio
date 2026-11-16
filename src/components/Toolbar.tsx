// 上部のツールバー（view）。ファイル・履歴・スライドの操作。

import { isDirty } from '../app/model';
import { useDispatch, useModel } from '../app/store';
import { usePlugins } from '../hooks/usePlugins';
import { openDeck, saveDeck } from '../io/commands';
import { PluginSlot } from './PluginSlot';

export function Toolbar() {
  const fileName = useModel((m) => m.fileName);
  const dirty = useModel(isDirty);
  const canUndo = useModel((m) => m.history.past.length > 0);
  const canRedo = useModel((m) => m.history.future.length > 0);
  const layouts = useModel((m) => m.deck.layouts);
  const current = useModel((m) => m.current);
  const hasSlide = useModel((m) => m.deck.slides.length > 0);
  const plugins = usePlugins();
  const dispatch = useDispatch();

  return (
    <header className="toolbar">
      <div className="group">
        <button className="button" onClick={() => void openDeck()} title="開く (Ctrl+O)">
          開く…
        </button>
        <button className="button" onClick={() => void saveDeck()} title="上書き保存 (Ctrl+S)">
          保存
        </button>
        <button className="button" onClick={() => void saveDeck(true)} title="名前を付けて保存 (Ctrl+Shift+S)">
          名前を付けて保存…
        </button>
      </div>

      <div className="group">
        <button className="button" disabled={!canUndo} onClick={() => dispatch({ type: 'Undo' })} title="元に戻す (Ctrl+Z)">
          ↶ 元に戻す
        </button>
        <button className="button" disabled={!canRedo} onClick={() => dispatch({ type: 'Redo' })} title="やり直し (Ctrl+Y)">
          ↷ やり直し
        </button>
      </div>

      <div className="group">
        {/* 選んだレイアウトで、表示中のスライドの後ろに追加する。選んだら先頭の表示に戻す */}
        <select
          className="button"
          value=""
          title="新しいスライド (Ctrl+M)"
          onChange={(e) => e.target.value && dispatch({ type: 'SlideAdded', after: current, layout: e.target.value })}
        >
          <option value="">＋ 新しいスライド…</option>
          {layouts.map((l) => (
            <option key={l.name} value={l.name}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          className="button"
          disabled={!hasSlide}
          onClick={() => dispatch({ type: 'SlideDuplicated', index: current })}
          title="スライドの複製 (Ctrl+D)"
        >
          複製
        </button>
        <button
          className="button"
          disabled={!hasSlide}
          onClick={() => dispatch({ type: 'SlideDeleted', index: current })}
          title="スライドの削除"
        >
          削除
        </button>
      </div>

      {/* 有効なプラグインの部品（登録した順に並ぶ）。部品は自分で Model の変化を購読して描き直す */}
      {plugins.map(
        ({ plugin, enabled }) =>
          enabled && plugin.toolbar && <PluginSlot key={plugin.name} name={plugin.name} view={plugin.toolbar} />,
      )}

      <span className="filename">
        {fileName}
        {dirty && <span className="dirty" title="保存していない変更があります"> ●</span>}
      </span>
    </header>
  );
}
