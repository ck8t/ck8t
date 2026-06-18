/**
 * Vite build config for the VS Code extension webview.
 *
 * Builds the ck8t React app as a single-page app
 * with all assets inlined or hashed, output to:
 *   extension/vscode/ck8t/webview/dist/
 *
 * Usage:
 *   cd ck8t
 *   VITE_CONVENGINE_BASE=BRIDGE_BASE_PLACEHOLDER vite build --config vite.extension.config.js
 *
 * The sentinel value BRIDGE_BASE_PLACEHOLDER is replaced at runtime by
 * Ck8tPanel._getHtml() with the actual bridge server address.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));

export default defineConfig({
  // No base path — the WebView serves assets via vscode-webview:// URIs
  base: './',

  build: {
    outDir: 'extension/vscode/ck8t/webview/dist',
    emptyOutDir: true,
    // Inline small assets so WebView CSP doesn't need extra sources
    assetsInlineLimit: 8192,
    rollupOptions: {
      // Dedicated webview entry — mounts only AgentBuilderPage.
      // Named 'index' so Vite outputs webview/dist/index.html (not webview-entry/index.html).
      input: { index: resolve(process.cwd(), 'webview-entry/index.html') },
      output: {
        // Split Monaco into its own chunk so it doesn't inflate the main bundle.
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
          'monaco-react': ['@monaco-editor/react'],
        },
      },
    },
    chunkSizeWarningLimit: 3000,
  },

  define: {
    __APP_NAME__: JSON.stringify(pkg.name),
  },

  plugins: [react(), tailwindcss()],

  resolve: {
    // Required for file: npm deps — resolves transitive imports (monaco-editor etc.)
    // from ck8t's node_modules rather than from the DUI source directory.
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom', 'monaco-editor', '@monaco-editor/react', 'zustand'],
  },

  // No proxy needed — the WebView calls the bridge server directly
  server: {
    proxy: {},
  },
});
