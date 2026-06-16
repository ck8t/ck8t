const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * Copy sql.js WASM binary into out/ so it ships with the extension.
 * Runs after every build (including watch rebuilds) so dev mode always has it.
 */
function copyWasmFile() {
  const src = path.join('node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const dst = path.join('out', 'sql-wasm.wasm');
  if (!fs.existsSync(src)) {
    console.warn('[wasm] sql-wasm.wasm not found in node_modules — skip');
    return;
  }
  fs.mkdirSync('out', { recursive: true });
  try {
    fs.copyFileSync(src, dst);
    console.log('[wasm] copied sql-wasm.wasm → out/');
  } catch (e) {
    if (e.code === 'EPIPE' || e.code === 'EBUSY') {
      console.warn(`[wasm] sql-wasm.wasm locked (${e.code}) — using existing copy`);
    } else {
      throw e;
    }
  }
}

/** @type {import('esbuild').Plugin} */
const wasmCopyPlugin = {
  name: 'wasm-copy',
  setup(build) {
    build.onStart(() => { if (watch) console.log('[ck8t] build started'); });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) console.error(`    ${location.file}:${location.line}:${location.column}`);
      });
      copyWasmFile();
      if (watch) console.log('[ck8t] build finished');
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [wasmCopyPlugin],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
