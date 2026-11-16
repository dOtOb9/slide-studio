// プラグインの部品に渡す窓口（pluginContext）のテスト。
// ctx.subscribe に部品が渡す関数も「外から来る値」（Step 7a audit-1 #1。監査役のレッドテストから移した）。

import { describe, expect, it, vi } from 'vitest';
import type { PluginContext } from '../plugin-api';
import { pluginContext, useStore } from './store';

// Step 7a audit-1 #1 の再発防止: 入口の一覧を人が数えたので ctx.subscribe を見落とした。
// ctx の関数ごとに「部品から来る不正な値を入れても dispatch・画面が止まらない」ことを試す。
// Record<keyof PluginContext, …> なので、PluginContext に関数を足すとここに書かないと型エラーになる
// （部品から値を受け取らない関数は null と書き、理由をコメントに残す）。
const badInputs: Record<keyof PluginContext, (() => void) | null> = {
  getModel: null, // 部品から値を受け取らない（アプリから部品へ渡すだけ）
  dispatch: () => {
    for (const bad of [null, undefined, 'Undo', 5, {}, { type: 5 }]) pluginContext.dispatch(bad as never);
  },
  subscribe: () => {
    const offs = [
      pluginContext.subscribe('not a function' as never),
      pluginContext.subscribe(() => {
        throw new Error('プラグインの不具合');
      }),
    ];
    try {
      pluginContext.dispatch({ type: 'SlideSelected', index: 1 });
    } finally {
      offs.forEach((off) => off());
    }
  },
};

describe('pluginContext の各関数は、部品から来る不正な値で止まらない', () => {
  it.each(Object.entries(badInputs).filter(([, run]) => run))('%s', (_name, run) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(run!).not.toThrow();
    expect(useStore.getState().model.deck).toBeDefined(); // Model が壊れていない
  });
});

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
