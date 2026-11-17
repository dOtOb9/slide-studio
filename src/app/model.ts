import type { Handle } from '../model/geometry';
import { missingImagePaths } from '../model/images';
import type { Deck, Rect, SlidePx } from '../model/types';

export interface Point {
  x: SlidePx;
  y: SlidePx;
}

export interface Box extends Rect {
  id: string;
}

export type MoveIfNullElseResizeByHandle = Handle | null;
export type MovedBeyondClickJitter = boolean;
export type DeckToPushOnceWhenGestureEnds = Deck;

export interface Gesture {
  id: string;
  handle: MoveIfNullElseResizeByHandle;
  start: Point;
  origin: Rect;
  keepRatio: boolean;
  moved: MovedBeyondClickJitter;
  before: DeckToPushOnceWhenGestureEnds;
}

export type OldestFirstLastIsPrevious = Deck[];
export type UndoneNextFirst = Deck[];

export interface History {
  past: OldestFirstLastIsPrevious;
  future: UndoneNextFirst;
}

export type DeckAtLastSaveOrOpenComparedByReference = Deck;
export type CounterForNewIdsUnlikeFileIds = number;
export type ZeroBasedSlideIndex = number;
export type MeasuredAfterRenderSinceFileMayOmitSize = Box[];
export type PluginStateKeptAcrossFilesNotSavedNotUndone = Record<string, unknown>;
export type ImageBlobsByPathOutsideHistoryAndDirtyCheck = Record<string, Blob>;
export type OpenedViaFileSystemAccessSoImageDirIsReachable = boolean;

export interface Model {
  deck: Deck;
  fileName: string;
  savedDeck: DeckAtLastSaveOrOpenComparedByReference;
  nextId: CounterForNewIdsUnlikeFileIds;
  current: ZeroBasedSlideIndex;
  selectedId: string | null;
  editingId: string | null;
  boxes: MeasuredAfterRenderSinceFileMayOmitSize;
  gesture: Gesture | null;
  history: History;
  plugins: PluginStateKeptAcrossFilesNotSavedNotUndone;
  images: ImageBlobsByPathOutsideHistoryAndDirtyCheck;
  canReadFolder: OpenedViaFileSystemAccessSoImageDirIsReachable;
}

export function defaultNewLayout(model: Model): string {
  const { layouts, slides } = model.deck;
  const current = slides[model.current]?.layout;
  const fileDefinesNoLayouts = layouts.length === 0;
  if (fileDefinesNoLayouts) return current ?? 'blank';
  const usuallyTitleAndBody = layouts[1] ?? layouts[0];
  const deckHasNoSlides = current === undefined;
  if (deckHasNoSlides) return usuallyTitleAndBody.name;
  const currentIsUsuallyCover = current === layouts[0].name;
  if (currentIsUsuallyCover) return usuallyTitleAndBody.name;
  return current;
}

export function needsFolderAccess(model: Model): boolean {
  return model.canReadFolder && missingImagePaths(model.deck, model.images).length > 0;
}

export const isDirty = (model: Model) => model.deck !== model.savedDeck;

export function initModel(deck: Deck, fileName: string): Model {
  return {
    deck,
    fileName,
    savedDeck: deck,
    nextId: 1,
    current: 0,
    selectedId: null,
    editingId: null,
    boxes: [],
    gesture: null,
    history: { past: [], future: [] },
    plugins: {},
    images: {},
    canReadFolder: false,
  };
}
