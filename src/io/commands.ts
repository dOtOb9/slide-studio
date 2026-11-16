// 画面のボタンやキー操作から呼ぶ「ファイルを開く／保存する」の手順。
// 読み書き（io/file.ts）をして、終わったら結果を Msg として送る。
// ツールバーとキーボードの両方から同じ手順を使うので、ここにまとめる。

import { isDirty } from '../app/model';
import type { Msg } from '../app/msg';
import { getModel, useStore } from '../app/store';
import { parseDeck } from '../model/parse';
import { serializeDeck } from '../model/serialize';
import { openFile, saveFile } from './file';

const dispatch = (msg: Msg) => useStore.getState().dispatch(msg);

export async function openDeck() {
  if (isDirty(getModel()) && !window.confirm('保存していない変更があります。破棄して開きますか？')) return;
  const result = await openFile();
  if (result) dispatch({ type: 'DeckLoaded', deck: parseDeck(result.html), fileName: result.name });
}

export async function saveDeck(saveAs = false) {
  // 書き込みには時間がかかり、その間に編集が続くこともあるので、保存する Deck をここで確定させる
  const { deck, fileName } = getModel();
  const name = await saveFile(serializeDeck(deck), fileName, saveAs);
  if (name) dispatch({ type: 'DeckSaved', deck, fileName: name });
}
