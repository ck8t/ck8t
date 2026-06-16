/**
 * Block Manager API client — talks to ck8t-server's /api/v1/block-manager/* endpoints.
 * Works in both browser (Vite dev) and VSCode extension webview (via __CK8T_BRIDGE_BASE__).
 */
const BASE = (
  globalThis.__CK8T_BRIDGE_BASE__ ||
  import.meta.env?.VITE_CONVENGINE_BASE ||
  'http://localhost:3001/api/v1'
).replace(/\/$/, '')

async function jsonOrThrow(res) {
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { /* non-json */ }
  if (!res.ok) {
    const msg = body?.error || text || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return body
}

/** List all installed blocks from ~/.salilvnair/ck8t/blocks/ */
export async function listInstalledBlocks() {
  return jsonOrThrow(await fetch(`${BASE}/block-manager/blocks`))
}

/**
 * Install a block from a GitHub URL.
 * @param {string} githubUrl e.g. https://github.com/user/ck8t-my-block
 */
export async function installBlock(githubUrl) {
  return jsonOrThrow(await fetch(`${BASE}/block-manager/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: githubUrl }),
  }))
}

/** Uninstall a block by id */
export async function uninstallBlock(id) {
  return jsonOrThrow(await fetch(`${BASE}/block-manager/blocks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }))
}

/**
 * Install a block from a local ZIP file.
 * @param {File} file — ZIP file selected via <input type="file">
 */
export async function installBlockFromZip(file) {
  const buffer = await file.arrayBuffer()
  const data = btoa(String.fromCharCode(...new Uint8Array(buffer)))
  return jsonOrThrow(await fetch(`${BASE}/block-manager/install-zip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, filename: file.name }),
  }))
}

/**
 * Check if a GitHub-installed block has a newer version on the remote.
 * Returns { hasUpdate, currentVersion, latestVersion } or null if no repository stored.
 */
export async function checkBlockUpdate(id) {
  return jsonOrThrow(await fetch(`${BASE}/block-manager/blocks/${encodeURIComponent(id)}/check-update`))
}

/** Pull the latest files from a block's original GitHub source. */
export async function updateBlock(id) {
  return jsonOrThrow(await fetch(`${BASE}/block-manager/blocks/${encodeURIComponent(id)}/update`, {
    method: 'POST',
  }))
}

/**
 * Dynamically load a block's UI definition from the server and register it.
 * Returns the block config object (or null on failure).
 */
export async function loadBlockUiFile(blockId, uiFile) {
  const url = `${BASE}/block-manager/ui/${encodeURIComponent(blockId)}/${uiFile}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const text = await res.text()
    const blob = new Blob([text], { type: 'application/javascript' })
    const blobUrl = URL.createObjectURL(blob)
    const mod = await import(/* @vite-ignore */ blobUrl)
    URL.revokeObjectURL(blobUrl)
    return mod.default ?? mod.block ?? null
  } catch (err) {
    console.warn(`[block-manager] Failed to load UI file ${uiFile} for "${blockId}":`, err)
    return null
  }
}
