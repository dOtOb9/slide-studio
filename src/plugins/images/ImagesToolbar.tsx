import { ImagePlus } from 'lucide-react';
import { useRef } from 'react';
import type { PluginViewProps } from '../../plugin-api/react';
import { insertImageFiles } from './prepare';
import './style.css';

const LABEL = '画像を挿入（貼り付け・ドラッグ&ドロップでも入れられます）';

function resetSoChoosingTheSameFileAgainFiresChange(input: HTMLInputElement) {
  input.value = '';
}

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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-images-input
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          resetSoChoosingTheSameFileAgainFiresChange(e.target);
          if (files.length > 0) void insertImageFiles(files, dispatch);
        }}
      />
    </>
  );
}
