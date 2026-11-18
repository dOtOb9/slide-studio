import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const KEEP_RAW_CSS_FOR_POLICY_TESTS_WHILE_NORMAL_CSS_IMPORTS_STAY_EMPTY = /\.css\?raw$/;

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    css: { include: [KEEP_RAW_CSS_FOR_POLICY_TESTS_WHILE_NORMAL_CSS_IMPORTS_STAY_EMPTY] },
  },
});
