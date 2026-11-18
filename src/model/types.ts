export type SlidePx = number;

export interface Rect {
  x: SlidePx;
  y: SlidePx;
  w: SlidePx;
  h: SlidePx;
}

export type DataPhName = string;
export type InlineStyleWithoutPosition = string;
export type PositionOrPlaceholderOverride = Partial<Rect>;
export type AppOnlyIdNotSavedToFile = string;
export type InnerHtml = string;
export type PlainTextNotes = string;
export type ThemeCss = string;

export interface Placeholder {
  name: DataPhName;
  rect: Partial<Rect>;
  style: InlineStyleWithoutPosition;
}

export interface Layout {
  name: string;
  placeholders: Placeholder[];
}

export interface SlideElement {
  id: AppOnlyIdNotSavedToFile;
  tag: string;
  ph?: DataPhName;
  rect: PositionOrPlaceholderOverride;
  style: InlineStyleWithoutPosition;
  attrs: Record<string, string>;
  html: InnerHtml;
}

export interface Slide {
  id: AppOnlyIdNotSavedToFile;
  layout: string;
  elements: SlideElement[];
  notes: PlainTextNotes;
}

export interface Deck {
  width: SlidePx;
  height: SlidePx;
  css: ThemeCss;
  layouts: Layout[];
  slides: Slide[];
}
