/**
 * Block registry — mirrors sim/apps/sim/blocks/registry.ts.
 *
 * Core blocks are imported statically. Third-party extensions are discovered
 * via Vite's import.meta.glob, so dropping a new file into
 * `ck8t/extensions/*.js` auto-registers the exported BlockConfig
 * (ComfyUI-style plugin pattern).
 */
import React from 'react'
import * as Core from './blocks'

/** Start with the core (sim-ported) block set. */
const registry = {
  starter: Core.StarterBlock,
  user_input: Core.UserInputBlock,
  agent: Core.AgentBlock,
  function: Core.FunctionBlock,
  condition: Core.ConditionBlock,
  router_v2: Core.RouterBlock,
  api: Core.ApiBlock,
  response: Core.ResponseBlock,
  loop: Core.LoopBlock,
  parallel: Core.ParallelBlock,
  postgresql: Core.PostgreSQLBlock,
  mcp: Core.McpBlock,
  smtp: Core.SmtpBlock,
  variables: Core.VariablesBlock,
  webhook_request: Core.WebhookRequestBlock,
  schedule: Core.ScheduleBlock,
  wait: Core.WaitBlock,
  table: Core.TableBlock,
  if_else: Core.IfElseBlock,
  if_elseif_else: Core.IfElseIfElseBlock,
  switch: Core.SwitchBlock,
  for_loop: Core.ForLoopBlock,
  for_each: Core.ForEachBlock,
  save_to_files: Core.SaveToFilesBlock,
  show_preview: Core.ShowPreviewBlock,
  json_map: Core.JsonMapBlock,
  text_template: Core.TextTemplateBlock,
  json_path: Core.JsonPathBlock,
  http_response: Core.HttpResponseBlock,
  error_handler: Core.ErrorHandlerBlock,
  merge: Core.MergeBlock,
  delay: Core.DelayBlock,
  filter: Core.FilterBlock,
  sub_workflow: Core.SubWorkflowBlock,
  crypto: Core.CryptoBlock,
  sort: Core.SortBlock,
  aggregate: Core.AggregateBlock,
  redis: Core.RedisBlock,
  mongodb: Core.MongoDbBlock,
  slack: Core.SlackBlock,
  ai_classifier: Core.AiClassifierBlock,
  mapper: Core.MapperBlock,
  skill: Core.SkillBlock,
}

/**
 * Vite glob-import of every extension module. Each module must export either
 * a default BlockConfig or a named `block` / `<Name>Block` export.
 */
const extensionModules = import.meta.glob('../extensions/*.js', { eager: true })
const extensionListeners = new Set()

function resolveExtensionExport(mod) {
  if (!mod) return null
  if (mod.default && mod.default.type) return mod.default
  if (mod.block && mod.block.type) return mod.block
  for (const k of Object.keys(mod)) {
    const v = mod[k]
    if (v && typeof v === 'object' && v.type && v.subBlocks) return v
  }
  return null
}

for (const [path, mod] of Object.entries(extensionModules)) {
  const block = resolveExtensionExport(mod)
  if (!block) continue
  if (registry[block.type]) {
    console.warn(`[ck8t] Extension at ${path} tried to overwrite core block "${block.type}"; skipped.`)
    continue
  }
  registry[block.type] = block
}

export function getBlock(type) {
  if (registry[type]) return registry[type]
  const normalized = type.replace(/-/g, '_')
  return registry[normalized]
}

export function getBlockByToolName(toolName) {
  return Object.values(registry).find((b) => b.tools?.access?.includes(toolName))
}

export function getBlocksByCategory(category) {
  return Object.values(registry).filter((b) => b.category === category)
}

export function getAllBlockTypes() {
  return Object.keys(registry)
}

export function getAllBlocks() {
  return Object.values(registry)
}

export function isValidBlockType(type) {
  return type in registry || type.replace(/-/g, '_') in registry
}

/**
 * Manual runtime registration for extensions loaded outside the glob
 * (e.g. from a user-supplied URL). Mirrors ComfyUI's registerNode API.
 */
export function registerBlock(block) {
  if (!block || !block.type) throw new Error('registerBlock: block.type is required')
  if (registry[block.type]) {
    console.warn(`[ck8t] registerBlock: overwriting existing "${block.type}"`)
  }
  registry[block.type] = block
  for (const l of extensionListeners) l()
  return block
}

export function onRegistryChange(fn) {
  extensionListeners.add(fn)
  return () => extensionListeners.delete(fn)
}

/**
 * Browser-side runners for community blocks.
 * Populated by loadInstalledBlocks() from block configs that include a `run` function.
 * The browser graph-runner checks this Map for unrecognised block types.
 */
export const customBrowserBlockRunners = new Map()

/**
 * Convert a plain SVG path string from a community block's `iconSvg` field
 * into a lightweight React component so it renders inside the node icon well.
 * Community blocks can't import React, so they supply the raw path `d` value.
 */
function makeSvgIcon(d) {
  function CommunityBlockIcon({ className, style }) {
    return React.createElement(
      'svg',
      { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', className, style },
      ...d.split('|').map((path, i) => React.createElement('path', { key: i, d: path.trim() })),
    )
  }
  return CommunityBlockIcon
}

/** Enrich a community block config before registering (icon, defaults, browser runner). */
function prepareBlock(blockConfig) {
  blockConfig.category = blockConfig.category || 'custom'
  if (typeof blockConfig.iconSvg === 'string' && !blockConfig.icon) {
    blockConfig.icon = makeSvgIcon(blockConfig.iconSvg)
  }
  if (typeof blockConfig.run === 'function' && !customBrowserBlockRunners.has(blockConfig.type)) {
    customBrowserBlockRunners.set(blockConfig.type, blockConfig.run.bind(blockConfig))
  }
}

/**
 * Dynamically load all installed blocks from the ck8t-server block-manager endpoint.
 * Called once on app startup. Blocks land in the 'custom' category automatically.
 * Safe to call multiple times — skips already-registered types.
 */
export async function loadInstalledBlocks() {
  // ── VS Code extension context ──────────────────────────────────────────────
  // The panel reads UI files server-side and injects their object literals as
  // window.__CK8T_BLOCK_DEFS__ in an inline script at startup.
  // After install/uninstall, the panel pushes updated defs via postMessage.
  const defs = globalThis.__CK8T_BLOCK_DEFS__
  if (defs && typeof defs === 'object' && Object.keys(defs).length > 0) {
    for (const blockConfig of Object.values(defs)) {
      if (!blockConfig || !blockConfig.type) continue
      // Always register the runner first, even if the block type is already in the registry
      // (guards against cases where the block was pre-registered without a runner).
      if (typeof blockConfig.run === 'function' && !customBrowserBlockRunners.has(blockConfig.type)) {
        customBrowserBlockRunners.set(blockConfig.type, blockConfig.run.bind(blockConfig))
        console.log('[ck8t] browser runner registered:', blockConfig.type)
      }
      if (registry[blockConfig.type]) continue
      prepareBlock(blockConfig)
      registerBlock(blockConfig)
    }
    if (globalThis.__CK8T_MODE__ === 'vscode-extension') return
  } else {
    console.log('[ck8t] loadInstalledBlocks: __CK8T_BLOCK_DEFS__ empty or missing', defs)
  }

  // ── Web UI context — fetch list from ck8t-server, then import UI files ────
  try {
    const base = (
      globalThis.__CK8T_BRIDGE_BASE__ ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONVENGINE_BASE) ||
      'http://localhost:3001/api/v1'
    ).replace(/\/$/, '')

    const res = await fetch(`${base}/block-manager/blocks`)
    if (!res.ok) return
    const installed = await res.json()
    if (!Array.isArray(installed)) return

    for (const manifest of installed) {
      for (const blockEntry of (manifest.blocks || [])) {
        if (!blockEntry.ui || !blockEntry.type) continue
        if (registry[blockEntry.type]) continue

        const uiUrl = `${base}/block-manager/ui/${encodeURIComponent(manifest.id)}/${blockEntry.ui}`
        try {
          const mod = await import(/* @vite-ignore */ uiUrl)
          const blockConfig = mod.default ?? mod.block ?? null
          if (blockConfig?.type) {
            prepareBlock(blockConfig)
            registerBlock(blockConfig)
          }
        } catch (err) {
          console.warn(`[ck8t] Failed to load block UI "${blockEntry.type}" from "${manifest.id}":`, err)
        }
      }
    }
  } catch {
    // server not running — silently skip
  }
}

export { registry }

/* ── Shared category & sub-group constants ── */

export const CATEGORY_LABELS = {
  blocks: 'Core Blocks',
  tools: 'Tools & Integrations',
  triggers: 'Triggers',
  custom: 'Custom',
}

export const CATEGORY_ORDER = ['blocks', 'tools', 'triggers', 'custom']

/**
 * Centralised category configuration — single source of truth for every
 * category's pinned top-level blocks and sub-group definitions.
 *
 * Every UI surface (BlockPalette, Canvas context-menu, WikiGuide) consumes
 * this config via `groupBlocksByCategory()`.  To re-organise blocks just
 * move types between groups here — all three surfaces update automatically.
 *
 * Shape per category:
 *   topTypes   – block types pinned above sub-groups (e.g. Starter)
 *   subgroups  – ordered list of { id, label, types[] }
 *
 * Blocks whose type doesn't appear in topTypes or any subgroup are
 * collected into an auto-generated "Other" group at the end.
 */
export const CATEGORY_CONFIG = {
  blocks: {
    topTypes: ['starter'],
    subgroups: [
      { id: 'input',      label: 'Input',              types: ['user_input', 'audio_input'] },
      { id: 'output',     label: 'Output',             types: ['http_response', 'response', 'save_to_files', 'show_preview', 'ext_save_logger', 'mapper'] },
      { id: 'essentials', label: 'Essentials',        types: ['variables', 'sub_workflow'] },
      { id: 'logic',      label: 'Logic & Flow',      types: ['condition', 'if_else', 'if_elseif_else', 'switch', 'router_v2', 'error_handler'] },
      { id: 'loops',      label: 'Loops',             types: ['loop', 'for_loop', 'for_each', 'parallel'] },
      { id: 'data',       label: 'Data & Transform',  types: ['json_map', 'json_path', 'text_template', 'table', 'filter', 'sort', 'aggregate', 'merge'] },
      { id: 'timing',     label: 'Timing',            types: ['wait', 'delay'] },
      { id: 'ai',         label: 'AI',                types: ['agent', 'ai_classifier'] },
    ],
  },
  tools: {
    topTypes: [],
    subgroups: [
      { id: 'api',       label: 'API',            types: ['api'] },
      { id: 'scripting', label: 'Scripting',     types: ['function', 'skill'] },
      { id: 'databases', label: 'Databases',     types: ['postgresql', 'redis', 'mongodb'] },
      { id: 'messaging', label: 'Messaging',     types: ['smtp', 'slack'] },
      { id: 'protocols', label: 'Protocols',     types: ['mcp'] },
      { id: 'security',  label: 'Security',      types: ['crypto'] },
    ],
  },
  triggers: {
    topTypes: [],
    subgroups: [
      { id: 'http',      label: 'HTTP',       types: ['webhook_request'] },
      { id: 'scheduled', label: 'Scheduled',  types: ['schedule'] },
    ],
  },
  custom: {
    topTypes: [],
    subgroups: [],
  },
}

/* Back-compat aliases — existing code that imports these still works. */
export const CORE_TOP_TYPES = CATEGORY_CONFIG.blocks.topTypes
export const CORE_SUBGROUPS = CATEGORY_CONFIG.blocks.subgroups

/**
 * Generic grouper for any category.
 * Returns { topItems: Block[], groups: { id, label, items: Block[] }[] }.
 */
export function groupBlocksByCategory(blocks, category) {
  const config = CATEGORY_CONFIG[category]
  if (!config) return { topItems: [], groups: blocks.length ? [{ id: 'all', label: 'All', items: blocks }] : [] }

  const typeMap = Object.fromEntries(blocks.map((b) => [b.type, b]))
  const used = new Set()

  const topItems = (config.topTypes || []).map((t) => typeMap[t]).filter(Boolean)
  topItems.forEach((b) => used.add(b.type))

  const groups = []
  for (const sg of config.subgroups) {
    const items = sg.types.map((t) => typeMap[t]).filter(Boolean)
    items.forEach((b) => used.add(b.type))
    if (items.length > 0) groups.push({ id: sg.id, label: sg.label, items })
  }

  const remaining = blocks.filter((b) => !used.has(b.type))
  if (remaining.length > 0) {
    // If any remaining block declares a 'group' field, cluster by it dynamically.
    const hasNamedGroups = remaining.some((b) => b.group)
    if (hasNamedGroups) {
      const dynamicMap = new Map()
      const ungrouped = []
      for (const b of remaining) {
        if (b.group) {
          if (!dynamicMap.has(b.group)) dynamicMap.set(b.group, [])
          dynamicMap.get(b.group).push(b)
        } else {
          ungrouped.push(b)
        }
      }
      for (const [label, items] of dynamicMap) {
        groups.push({ id: label.toLowerCase().replace(/\s+/g, '-'), label, items })
      }
      if (ungrouped.length > 0) groups.push({ id: 'other', label: 'Other', items: ungrouped })
    } else {
      groups.push({ id: 'other', label: 'Other', items: remaining })
    }
  }

  return { topItems, groups }
}

/** @deprecated Use groupBlocksByCategory(blocks, 'blocks') instead. */
export function groupCoreBlocks(blocks) {
  return groupBlocksByCategory(blocks, 'blocks')
}
