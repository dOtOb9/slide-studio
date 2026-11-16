// デッキ（スライドファイル1つ分）のメモリ上の表現。
// ファイル形式は HTML だが、アプリ内ではこの素直なデータ構造に変換して扱う。

/** 位置とサイズ（単位: スライド座標の px。1920x1080 が基準） */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** レイアウト（マスター）上のプレースホルダー。<template> 内の data-ph 要素 */
export interface Placeholder {
  name: string; // data-ph の値（"title", "body" など）
  rect: Partial<Rect>;
  style: string; // 位置以外のインラインスタイル（枠線など）
}

/** レイアウト。<template data-layout="..."> 1つに対応 */
export interface Layout {
  name: string;
  placeholders: Placeholder[];
}

/** スライド上の要素1つ */
export interface SlideElement {
  id: string; // アプリ内でだけ使う識別子（ファイルには保存しない）
  tag: string; // "div", "img" など
  ph?: string; // プレースホルダー名。無ければ自由配置の要素
  rect: Partial<Rect>; // 指定された位置。プレースホルダーなら「上書き分」だけ
  style: string; // 位置以外のインラインスタイル
  attrs: Record<string, string>; // src など、その他の属性
  html: string; // 中身の HTML
}

/** スライド1枚。<section data-layout="..."> に対応 */
export interface Slide {
  id: string;
  layout: string;
  elements: SlideElement[];
}

/** デッキ全体 */
export interface Deck {
  width: number;
  height: number;
  css: string; // テーマ CSS（<style> の中身）
  layouts: Layout[];
  slides: Slide[];
}
