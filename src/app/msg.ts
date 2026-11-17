import type { Handle } from '../model/geometry';
import type { Deck } from '../model/types';
import type { Box, Point } from './model';

export type CtrlOrMacCmd = boolean;

export interface KeyInput {
  key: string;
  shift: boolean;
  mod: CtrlOrMacCmd;
}

export type FalseOnOpenKeepCurrentOnSaveIfOmitted = boolean | undefined;
export type DeckAsOfWhenSavingStarted = Deck;

export type CoreMsg =
  | { type: 'DeckLoaded'; deck: Deck; fileName: string; canReadFolder?: FalseOnOpenKeepCurrentOnSaveIfOmitted }
  | { type: 'DeckSaved'; deck: DeckAsOfWhenSavingStarted; fileName: string; canReadFolder?: FalseOnOpenKeepCurrentOnSaveIfOmitted }
  | { type: 'ImagesAdded'; images: Record<string, Blob> }
  | { type: 'SlideSelected'; index: number }
  | { type: 'SlideAdded'; after: number; layout: string }
  | { type: 'SlideDuplicated'; index: number }
  | { type: 'SlideDeleted'; index: number }
  | { type: 'SlideMoved'; from: number; to: number }
  | { type: 'NotesCommitted'; index: number; notes: string }
  | { type: 'ElementSelected'; id: string | null }
  | { type: 'DragStarted'; id: string; handle: Handle | null; pointer: Point }
  | { type: 'DragMoved'; pointer: Point; shift: boolean }
  | { type: 'DragEnded' }
  | { type: 'EditRequested'; id: string }
  | { type: 'TextCommitted'; id: string; html: string }
  | ({ type: 'KeyPressed' } & KeyInput)
  | { type: 'BoxesMeasured'; boxes: Box[] }
  | { type: 'Undo' }
  | { type: 'Redo' };

export type PluginMsgDeclaredWithTypeNotInterfaceSoIndexSignatureMatches = {
  type: `${string}/${string}`;
  [key: string]: unknown;
};
export type PluginMsg = PluginMsgDeclaredWithTypeNotInterfaceSoIndexSignatureMatches;

export type Msg = CoreMsg | PluginMsg;
