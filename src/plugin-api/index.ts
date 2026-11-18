import {
  currentSlide,
  edit,
  findElement,
  getPluginState,
  isBusy,
  setPluginState,
  withNewIds,
} from '../app/helpers';
import type { Model } from '../app/model';
import type { KeyInput, Msg, PluginMsg } from '../app/msg';
import { imagePathOf, sha256Hex } from '../io/images';
import { deleteElement, insertElement, setNotes, updateElement } from '../model/commands';
import { checkImageFile, extensionOf, imagePath, isImagePath } from '../model/images';

export const API_VERSION = '1.4';

export type { KeyInput, Model, Msg, PluginMsg };
export type { Deck, Layout, Placeholder, Rect, Slide, SlideElement } from '../model/types';
export type { ElementPatch } from '../model/commands';

export interface PluginContext {
  getModel(): Model;
  dispatch(msg: Msg): void;
  subscribe(listener: () => void): () => void;
  slideArea(): HTMLElement | null;
}

export interface PluginView {
  mount(container: HTMLElement, ctx: PluginContext): () => void;
}

export interface Plugin<M extends PluginMsg = PluginMsg> {
  name: string;
  apiVersion: string;
  title?: string;
  description?: string;
  update?(model: Model, msg: M): Model;
  onKey?(model: Model, key: KeyInput): M | null;
  toolbar?: PluginView;
}

export {
  checkImageFile,
  currentSlide,
  deleteElement,
  edit,
  extensionOf,
  findElement,
  getPluginState,
  imagePath,
  imagePathOf,
  insertElement,
  isBusy,
  isImagePath,
  setNotes,
  setPluginState,
  sha256Hex,
  updateElement,
  withNewIds,
};

export const api = {
  version: API_VERSION,
  edit,
  withNewIds,
  currentSlide,
  findElement,
  isBusy,
  getPluginState,
  setPluginState,
  insertElement,
  updateElement,
  deleteElement,
  setNotes,
  imagePathOf,
  sha256Hex,
  imagePath,
  isImagePath,
  checkImageFile,
  extensionOf,
};

export type PluginApi = typeof api;

export function isCompatible(pluginVersion: string, appVersion: string = API_VERSION): boolean {
  const parse = (v: string) => {
    const m = /^(\d+)\.(\d+)$/.exec(v);
    return m ? { major: Number(m[1]), minor: Number(m[2]) } : null;
  };
  const p = parse(pluginVersion);
  const a = parse(appVersion);
  if (!p || !a) return false;
  return p.major === a.major && p.minor <= a.minor;
}
