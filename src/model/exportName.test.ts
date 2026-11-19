import { describe, expect, it } from 'vitest';
import { exportFileName } from './exportName';

describe('exportFileName（書き出すファイルの名前の候補）', () => {
  it('開いたファイルの名前から拡張子を外し、書き出しの形式の id と拡張子を付ける（元の deck.html を上書きしないように）', () => {
    expect(exportFileName('deck.html', 'slideshow', 'html')).toBe('deck-slideshow.html');
    expect(exportFileName('my.talk.htm', 'text', 'txt')).toBe('my.talk-text.txt');
  });

  it('拡張子の無い名前・空の名前でも名前を作る', () => {
    expect(exportFileName('deck', 'pdf', 'pdf')).toBe('deck-pdf.pdf');
    expect(exportFileName('', 'pdf', 'pdf')).toBe('deck-pdf.pdf');
  });
});
