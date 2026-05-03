/**
 * build-website.js
 *
 * Builds the ck8t app for the portfolio website and copies the dist output
 * to the portfolio repo's public/framework/ck8t/ directory.
 *
 * Usage:
 *   npm run build:website
 *
 * Required .env (in the ck8t root):
 *   WEBSITE_PATH=/absolute/path/to/salilvnair.github.io
 *
 * What it does:
 *   1. Reads WEBSITE_PATH from .env
 *   2. Runs: VITE_BASE_PATH=/framework/ck8t/ vite build
 *   3. Copies dist/ → {WEBSITE_PATH}/public/framework/ck8t/
 */

import { execSync }                    from 'node:child_process'
import { existsSync, readFileSync, rmSync, cpSync } from 'node:fs'
import { resolve, join }               from 'node:path'
import { fileURLToPath }               from 'node:url'

const __dir     = fileURLToPath(new URL('.', import.meta.url))
const ROOT      = resolve(__dir, '..')
const ENV_FILE  = join(ROOT, '.env')
const DIST      = join(ROOT, 'dist')
const BASE_PATH = '/framework/ck8t/'

/* ── helpers ────────────────────────────────────────────────────────────── */

function parseEnv(file) {
  const vars = {}
  if (!existsSync(file)) return vars
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    vars[key] = val
  }
  return vars
}

function log(msg)  { console.log(`\x1b[36m▶\x1b[0m  ${msg}`) }
function ok(msg)   { console.log(`\x1b[32m✔\x1b[0m  ${msg}`) }
function fail(msg) { console.error(`\x1b[31m✖\x1b[0m  ${msg}`); process.exit(1) }

/* ── main ───────────────────────────────────────────────────────────────── */

const env = parseEnv(ENV_FILE)

if (!env.WEBSITE_PATH) {
  fail(
    'WEBSITE_PATH is not set.\n' +
    '  Create a .env file in the ck8t root:\n' +
    '  WEBSITE_PATH=/path/to/salilvnair.github.io'
  )
}

const websitePath = resolve(env.WEBSITE_PATH)

if (!existsSync(websitePath)) {
  fail(`WEBSITE_PATH does not exist: ${websitePath}`)
}

const dest = join(websitePath, 'public', 'framework', 'ck8t')

/* 1. Build */
log(`Building with base path: ${BASE_PATH}`)
execSync(`VITE_BASE_PATH=${BASE_PATH} npx vite build`, {
  cwd:   ROOT,
  stdio: 'inherit',
  env:   { ...process.env, VITE_BASE_PATH: BASE_PATH },
})
ok('Build complete')

/* 2. Clear old output and copy fresh dist */
log(`Copying dist → ${dest}`)
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
cpSync(DIST, dest, { recursive: true })
ok(`Deployed to ${dest}`)
