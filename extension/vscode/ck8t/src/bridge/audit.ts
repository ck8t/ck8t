/**
 * AI audit log — records every LLM call made through the bridge.
 * Ring-buffer capped at maxEntries; persisted to SQLite so entries survive
 * panel reloads (cleared only on explicit user action or extension uninstall).
 */
import { upsert, findById } from '../storage/db';

export interface AuditEntry {
  id: string;
  timestamp: string;
  stage: string;
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  request?: unknown;
  response?: unknown;
  durationMs?: number;
  error?: string;
}

let _maxEntries = 200;
const _entries: AuditEntry[] = [];
let _seq = 0;
let _persistEnabled = false;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Call once after DB is ready. Loads persisted entries and enables SQLite writes. */
export function initAuditPersistence(maxEntries = 200): void {
  _maxEntries = maxEntries;
  _persistEnabled = true;
  try {
    const saved = findById<{ entries: AuditEntry[] }>('audit_log', 'main');
    if (saved?.entries?.length) {
      _entries.push(...saved.entries.slice(-_maxEntries));
      _seq = _entries.length;
    }
  } catch { /* DB not ready yet — ignore */ }
}

export function setAuditMaxEntries(n: number): void {
  _maxEntries = Math.max(10, Math.min(5000, n));
  if (_entries.length > _maxEntries) _entries.splice(0, _entries.length - _maxEntries);
  _scheduleSave();
}

export function getAuditMaxEntries(): number { return _maxEntries; }

function _scheduleSave(): void {
  if (!_persistEnabled) return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { upsert('audit_log', 'main', { entries: [..._entries] }); } catch { /* ignore */ }
  }, 500);
}

export function addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
  _entries.push({
    id: `a${++_seq}_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (_entries.length > _maxEntries) _entries.splice(0, _entries.length - _maxEntries);
  _scheduleSave();
}

export function getAuditEntries(): AuditEntry[] {
  return [..._entries].reverse();
}

export function clearAuditEntries(): void {
  _entries.length = 0;
  _scheduleSave();
}

export function getAuditStats() {
  return {
    total: _entries.length,
    errors: _entries.filter((e) => e.error).length,
    models: [...new Set(_entries.map((e) => e.model).filter(Boolean))],
  };
}
