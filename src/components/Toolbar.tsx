// 上部のツールバー（view）。ファイルを開く・元に戻す・やり直し。

import type { ChangeEvent } from 'react';
import { useDispatch, useModel } from '../app/store';
import { parseDeck } from '../model/parse';

export function Toolbar() {
  const fileName = useModel((m) => m.fileName);
  const canUndo = useModel((m) => m.history.past.length > 0);
  const canRedo = useModel((m) => m.history.future.length > 0);
  const dispatch = useDispatch();

  // ファイルの読み込みは非同期の「外の世界」とのやり取り（Elm でいう Cmd）。
  // 読み終わって Deck に変換してから、結果を Msg として送る
  const openFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルをもう一度選べるように
    if (!file) return;
    dispatch({ type: 'DeckLoaded', deck: parseDeck(await file.text()), fileName: file.name });
  };

  return (
    <header className="toolbar">
      <label className="button">
        開く…
        <input type="file" accept=".html,.htm" onChange={openFile} hidden />
      </label>
      <button className="button" disabled={!canUndo} onClick={() => dispatch({ type: 'Undo' })} title="元に戻す (Ctrl+Z)">
        ↶ 元に戻す
      </button>
      <button className="button" disabled={!canRedo} onClick={() => dispatch({ type: 'Redo' })} title="やり直し (Ctrl+Y)">
        ↷ やり直し
      </button>
      <span className="filename">{fileName}</span>
    </header>
  );
}
