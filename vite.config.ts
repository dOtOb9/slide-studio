import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom', // テストでも DOMParser を使えるようにする
    // vitest は既定で CSS の中身を空にする。src/ui-policy.test.ts が CSS を `?raw` で読んで
    // UI の方針を確かめるので、「?raw の CSS」だけは生のまま通す（ふつうの CSS の import は空のまま）。
    css: { include: [/\.css\?raw$/] },
  },
});
