// ツールバーの「画像を挿入」ボタン（view）。押すとファイルの選択が開き、選んだ画像（複数可）を挿入する。
// store は import せず、Model と dispatch を props で受け取る（plugin-api/react.tsx の PluginViewProps）。
// 貼り付けとドロップは、ページ全体のイベントなので events.ts（plugin.ts の mount で登録）。

import { ImagePlus } from 'lucide-react';
import { useRef } from 'react';
import type { PluginViewProps } from '../../plugin-api/react';
import { insertImageFiles } from './prepare';
import './style.css';

const LABEL = '画像を挿入（貼り付け・ドラッグ&ドロップでも入れられます）';

export function ImagesToolbar({ model, dispatch }: PluginViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSlide = model.deck.slides.length > 0;
  return (
    <>
      <button
        className="icon-button"
        disabled={!hasSlide}
        onClick={() => inputRef.current?.click()}
        title={LABEL}
        aria-label={LABEL}
      >
        <ImagePlus />
      </button>
      {/* ファイルの選択の窓口。見せずに、上のボタンから開く。
          accept は選択の画面の絞り込みだけ（ほかの形式も選べてしまうので、形式は prepare.ts で確かめて断る） */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-images-input
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ''; // 同じファイルをもう一度選んでも change が起きるように空に戻す
          if (files.length > 0) void insertImageFiles(files, dispatch);
        }}
      />
    </>
  );
}
