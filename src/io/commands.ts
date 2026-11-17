import { isDirty } from '../app/model';
import type { Msg } from '../app/msg';
import { getModel, useStore } from '../app/store';
import {
  imagesLostBySave,
  imagesToWrite,
  lostImagesQuestion,
  missingImagePaths,
  type SaveDestination,
} from '../model/images';
import { parseDeck } from '../model/parse';
import { openFile, readImageFiles, requestFolder, saveFile } from './file';
import { deckHtml } from './images';

const dispatch = (msg: Msg) => useStore.getState().dispatch(msg);

const report = (what: string, e: unknown) =>
  window.alert(`${what}できませんでした: ${e instanceof Error ? e.message : String(e)}`);

export async function openDeck() {
  if (isDirty(getModel()) && !window.confirm('保存していない変更があります。破棄して開きますか？')) return;
  try {
    const result = await openFile();
    if (!result) return;
    dispatch({ type: 'DeckLoaded', deck: parseDeck(result.html), fileName: result.name, canReadFolder: result.canReadFolder });
    if (result.folderAlreadyGranted) await loadMissingImages();
  } catch (e) {
    report('開く', e);
  }
}

export async function grantFolderAccess() {
  try {
    if (!(await requestFolder())) return;
    const problems = await loadMissingImages();
    if (problems.length > 0) window.alert(`images/ から読めなかった画像が ${problems.length} 件あります（詳しくはコンソール）`);
  } catch (e) {
    report('画像の読み込みが', e);
  }
}

async function loadMissingImages(): Promise<string[]> {
  const { deck, images } = getModel();
  const result = await readImageFiles(missingImagePaths(deck, images));
  if (result.openedAnotherFileWhileReading) return [];
  if (result.problems.length > 0) console.warn('images/ から読めなかった画像があります', result.problems);
  if (Object.keys(result.images).length > 0) dispatch({ type: 'ImagesAdded', images: result.images });
  return result.problems;
}

export async function saveDeck(saveAs = false) {
  const { deck: deckFixedBeforeSlowWrites, fileName, images, canReadFolder } = getModel();
  const deck = deckFixedBeforeSlowWrites;
  try {
    const proceed = (dest: SaveDestination) => {
      const lost = imagesLostBySave(deck, images, dest);
      return lost.length === 0 || window.confirm(lostImagesQuestion(lost.length, canReadFolder));
    };
    const saved = await saveFile(
      fileName,
      saveAs,
      imagesToWrite(deck, images),
      (imagesWrittenToFolder) => deckHtml(deck, images, imagesWrittenToFolder),
      proceed,
    );
    if (!saved) return;
    dispatch({ type: 'DeckSaved', deck, fileName: saved.name, canReadFolder: saved.canReadFolder });
    if (saved.embedded) window.alert('フォルダに書けないので、画像を deck.html の中に入れて保存しました');
  } catch (e) {
    report('保存', e);
  }
}
