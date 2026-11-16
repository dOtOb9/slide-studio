// 画面のボタンやキー操作から呼ぶ「ファイルを開く／保存する」の手順。
// 読み書き（io/file.ts）をして、終わったら結果を Msg として送る。
// ツールバーとキーボードの両方から同じ手順を使うので、ここにまとめる。

import { isDirty } from '../app/model';
import type { Msg } from '../app/msg';
import { getModel, useStore } from '../app/store';
import { imagesToWrite, missingImagePaths } from '../model/images';
import { parseDeck } from '../model/parse';
import { canWriteImageFiles, openFile, readImageFiles, requestFolder, saveFile } from './file';
import { deckHtml } from './images';

const dispatch = (msg: Msg) => useStore.getState().dispatch(msg);

/** 失敗の理由を知らせる（書き込みを許可しなかった、ダイアログが既に開いている など） */
const report = (what: string, e: unknown) =>
  window.alert(`${what}できませんでした: ${e instanceof Error ? e.message : String(e)}`);

export async function openDeck() {
  if (isDirty(getModel()) && !window.confirm('保存していない変更があります。破棄して開きますか？')) return;
  try {
    const result = await openFile();
    if (!result) return;
    dispatch({ type: 'DeckLoaded', deck: parseDeck(result.html), fileName: result.name, canReadFolder: result.canReadFolder });
    // 前に許可されたフォルダのファイルなら、許可を求めずに images/ の画像を読む
    if (result.folderReady) await loadMissingImages();
  } catch (e) {
    report('開く', e);
  }
}

/** 「フォルダへのアクセスを許可」: ファイルのあるフォルダを選んでもらい、images/ の画像を読む */
export async function grantFolderAccess() {
  try {
    if (!(await requestFolder())) return;
    const problems = await loadMissingImages();
    // 押した人に、読めなかった画像があることを知らせる（理由の一覧はコンソール）
    if (problems.length > 0) window.alert(`images/ から読めなかった画像が ${problems.length} 件あります（詳しくはコンソール）`);
  } catch (e) {
    report('フォルダを読み込む', e);
  }
}

/** 使っている画像のうち、中身を持っていないものを images/ から読み、ImagesAdded で送る。読めなかったものの理由を返す */
async function loadMissingImages(): Promise<string[]> {
  const { deck, images } = getModel();
  const result = await readImageFiles(missingImagePaths(deck, images));
  if (result.stale) return []; // 読んでいる間に別のファイルを開いた
  if (result.problems.length > 0) console.warn('images/ から読めなかった画像があります', result.problems);
  if (Object.keys(result.images).length > 0) dispatch({ type: 'ImagesAdded', images: result.images });
  return result.problems;
}

export async function saveDeck(saveAs = false) {
  // 書き込みには時間がかかり、その間に編集が続くこともあるので、保存する Deck をここで確定させる
  const { deck, fileName, images } = getModel();
  try {
    // 中身を持っている画像を images/ に書く。持っていない画像（フォルダを許可していない等）は参照のまま。
    // フォルダに書けないブラウザでは、画像を data URI で埋め込んだ1ファイルにする
    const html = await deckHtml(deck, images, canWriteImageFiles);
    const toWrite = canWriteImageFiles ? imagesToWrite(deck, images) : {};
    const saved = await saveFile(html, fileName, saveAs, toWrite);
    if (saved) dispatch({ type: 'DeckSaved', deck, fileName: saved.name, canReadFolder: saved.canReadFolder });
  } catch (e) {
    report('保存', e);
  }
}
