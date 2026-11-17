// 上部のツールバー（view）。ファイル・履歴・スライドの操作。
//
// UI の方針（AGENTS.md）: ボタンはアイコンで示し、説明の文字はツールチップ（title）に書く。
// アイコンは lucide-react（SVG の部品。使ったアイコンだけがビルドに入る）。
// まとまり（.group）は区切り線でなく、背景の色差で分ける（index.css）。

import { Copy, FolderKey, FolderOpen, Plus, Redo2, Save, SaveAll, Trash2, Undo2 } from 'lucide-react';
import { isDirty, needsFolderAccess } from '../app/model';
import { useDispatch, useModel } from '../app/store';
import { usePlugins } from '../hooks/usePlugins';
import { grantFolderAccess, openDeck, saveDeck } from '../io/commands';
import { IconButton } from './IconButton';
import { PluginManager } from './PluginManager';
import { PluginSlot } from './PluginSlot';

export function Toolbar() {
  const fileName = useModel((m) => m.fileName);
  const dirty = useModel(isDirty);
  const askFolder = useModel(needsFolderAccess);
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
        <IconButton label="開く (Ctrl+O)" onClick={() => void openDeck()}>
          <FolderOpen />
        </IconButton>
        <IconButton label="上書き保存 (Ctrl+S)" onClick={() => void saveDeck()}>
          <Save />
        </IconButton>
        <IconButton label="名前を付けて保存 (Ctrl+Shift+S)" onClick={() => void saveDeck(true)}>
          <SaveAll />
        </IconButton>
        {/* images/ の画像を使っているのに、まだ読めていないときだけ出る（出す条件は app/model.ts の needsFolderAccess） */}
        {askFolder && (
          <IconButton
            label="フォルダへのアクセスを許可（images/ の画像を表示する）"
            onClick={() => void grantFolderAccess()}
          >
            <FolderKey />
          </IconButton>
        )}
      </div>

      <div className="group">
        <IconButton label="元に戻す (Ctrl+Z)" disabled={!canUndo} onClick={() => dispatch({ type: 'Undo' })}>
          <Undo2 />
        </IconButton>
        <IconButton label="やり直し (Ctrl+Y)" disabled={!canRedo} onClick={() => dispatch({ type: 'Redo' })}>
          <Redo2 />
        </IconButton>
      </div>

      <div className="group">
        {/* 見た目は ＋ のアイコン。上に透明な <select> を重ねてあり、押すとレイアウトの一覧が出る。
            選んだレイアウトで、表示中のスライドの後ろに追加する。選んだら空の表示に戻す */}
        <span className="icon-button select-button" title="新しいスライド (Ctrl+M)">
          <Plus />
          <select
            value=""
            aria-label="新しいスライド（レイアウトを選ぶ）"
            onChange={(e) => e.target.value && dispatch({ type: 'SlideAdded', after: current, layout: e.target.value })}
          >
            <option value="" disabled>
              レイアウトを選ぶ
            </option>
            {layouts.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
        </span>
        <IconButton
          label="スライドの複製 (Ctrl+D)"
          disabled={!hasSlide}
          onClick={() => dispatch({ type: 'SlideDuplicated', index: current })}
        >
          <Copy />
        </IconButton>
        <IconButton
          label="スライドの削除"
          disabled={!hasSlide}
          onClick={() => dispatch({ type: 'SlideDeleted', index: current })}
        >
          <Trash2 />
        </IconButton>
      </div>

      {/* 有効なプラグインの部品（登録した順に並ぶ）。部品は自分で Model の変化を購読して描き直す */}
      {plugins.map(
        ({ plugin, enabled }) =>
          enabled && plugin.toolbar && <PluginSlot key={plugin.name} name={plugin.name} view={plugin.toolbar} />,
      )}

      <PluginManager />

      <span className="filename">
        {fileName}
        {dirty && <span className="dirty" title="保存していない変更があります"> ●</span>}
      </span>
    </header>
  );
}
