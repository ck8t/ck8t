/**
 * secret-store — wraps VS Code SecretStorage for API key persistence.
 *
 * VS Code SecretStorage uses the OS keychain on every platform:
 *   macOS  → Keychain Access
 *   Windows → Windows Credential Manager
 *   Linux   → libsecret / GNOME Keyring / KWallet
 *
 * Keys are namespaced as "ck8t.llm.<providerId>" so they never collide with
 * other extensions or other ck8t collections.
 */
import * as vscode from 'vscode';
import { findAll, upsert } from '../storage/db';

const KEY_PREFIX = 'ck8t.llm';

let _secrets: vscode.SecretStorage | undefined;

export function initSecretStore(secrets: vscode.SecretStorage): void {
  _secrets = secrets;
}

function keyFor(providerId: string): string {
  return `${KEY_PREFIX}.${providerId}`;
}

export async function storeApiKey(providerId: string, token: string): Promise<void> {
  if (!_secrets) throw new Error('SecretStore not initialized — call initSecretStore first');
  await _secrets.store(keyFor(providerId), token);
}

export async function retrieveApiKey(providerId: string): Promise<string | undefined> {
  if (!_secrets) return undefined;
  return _secrets.get(keyFor(providerId));
}

export async function deleteApiKey(providerId: string): Promise<void> {
  if (!_secrets) return;
  await _secrets.delete(keyFor(providerId));
}

/** Returns a map of providerId → hasKey (never exposes actual tokens to callers). */
export async function getAllKeyStatus(providerIds: string[]): Promise<Record<string, boolean>> {
  if (!_secrets) return {};
  const results: Record<string, boolean> = {};
  await Promise.all(
    providerIds.map(async (id) => {
      const val = await _secrets!.get(keyFor(id));
      results[id] = !!val && val.length > 0;
    }),
  );
  return results;
}

/**
 * One-time sweep: earlier builds wrote the raw API key into SQLite
 * (`ai_provider_keys.key` and `custom_providers.apiKey`) before this key ever
 * reached SecretStorage. Move any such plaintext key into the OS keychain and
 * scrub it from the DB record. Safe to call on every activation — a no-op
 * once a record has no `key`/`apiKey` field left.
 */
export async function migrateLegacyApiKeys(): Promise<void> {
  if (!_secrets) return;

  const keyRecords = findAll<{ id: string; key?: string }>('ai_provider_keys');
  for (const rec of keyRecords) {
    if (rec.key) {
      await storeApiKey(rec.id, rec.key);
      upsert('ai_provider_keys', rec.id, { id: rec.id });
    }
  }

  const providerRecords = findAll<{ key: string; apiKey?: string }>('custom_providers');
  for (const rec of providerRecords) {
    if (rec.apiKey) {
      await storeApiKey(rec.key, rec.apiKey);
      const { apiKey: _apiKey, ...rest } = rec;
      upsert('custom_providers', rec.key, rest);
    }
  }
}
