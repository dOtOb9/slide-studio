// プラグインの部品に渡す窓口（pluginContext）のテスト。
// ctx.subscribe に部品が渡す関数も「外から来る値」（Step 7a audit-1 #1。監査役のレッドテストから移した）。

import { describe, expect, it, vi } from 'vitest';
import { pluginContext, useStore } from './store';

describe('pluginContext.subscribe（外部プラグインの部品が渡す listener）', () => {
  it('#1 部品の listener が例外を出しても、dispatch は例外を出さず、他の購読者（画面）にも変更が届く', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const unsubBad = pluginContext.subscribe(() => {
      throw new Error('プラグインの不具合');
    });
    const screen = vi.fn();
    const unsubScreen = useStore.subscribe(screen);
    try {
      expect(() => pluginContext.dispatch({ type: 'SlideSelected', index: 1 })).not.toThrow();
      expect(screen).toHaveBeenCalled();
    } finally {
      unsubBad();
      unsubScreen();
    }
  });

  it('#1 部品が関数でないものを subscribe に渡しても、dispatch は例外を出さない', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const unsub = pluginContext.subscribe('not a function' as unknown as () => void);
    try {
      expect(() => pluginContext.dispatch({ type: 'SlideSelected', index: 2 })).not.toThrow();
    } finally {
      unsub();
    }
  });
});
