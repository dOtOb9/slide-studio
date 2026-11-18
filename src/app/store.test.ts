import { describe, expect, it, vi } from 'vitest';
import type { PluginContext } from '../plugin-api';
import { pluginContext, useStore } from './store';

type NoInputFromComponent = { takesNoValueFromComponentBecause: string };

const badInputsForEachContextFunction: Record<keyof PluginContext, (() => void) | NoInputFromComponent> = {
  getModel: { takesNoValueFromComponentBecause: 'アプリから部品へ Model を渡すだけ' },
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

const runnableBadInputs = Object.entries(badInputsForEachContextFunction).filter(
  (entry): entry is [string, () => void] => typeof entry[1] === 'function',
);

describe('pluginContext の各関数は、部品から来る不正な値で止まらない（PluginContext に関数を足すと、ここに書くまで型エラー。Step 7a audit-1 #1）', () => {
  it.each(runnableBadInputs)('%s', (_name, run) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(run).not.toThrow();
    expect(useStore.getState().model.deck, 'Model が壊れていない').toBeDefined();
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
