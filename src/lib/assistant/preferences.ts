import 'server-only';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireWorkspaceAccess } from '@/lib/auth/access';
import { adminClient, isDemoGuestSession, isLocalAuth } from '@/lib/auth/service';
import { AccessError } from '@/lib/auth/core';
import { DEFAULT_PREFERENCES, mergePreferences, normalizePreferences, validatePatch, type AssistantPreferences } from './preferences-model';
export type { AssistantPreferences } from './preferences-model';

/**
 * Personal Ask Prodwise preferences, per user across devices (decision D8).
 * Local auth keeps them in .data/assistant-preferences.json; hosted auth in
 * users.preferences->'assistant' (migration 0046, written through an RPC that
 * accepts only the four known keys). They are not product records, so the
 * product write gate does not apply — the same as notification read marks.
 * A shared Demo guest session never persists them: the panel keeps them in
 * memory for that session only.
 */
const localPath = () => join(process.cwd(), '.data', 'assistant-preferences.json');
interface LocalFile { version: 1; users: Record<string, unknown> }
const readLocal = (): LocalFile => existsSync(localPath()) ? JSON.parse(readFileSync(localPath(), 'utf8')) as LocalFile : { version: 1, users: {} };
function writeLocal(v: LocalFile) { mkdirSync(join(process.cwd(), '.data'), { recursive: true }); const tmp = `${localPath()}.${randomUUID()}.tmp`; writeFileSync(tmp, JSON.stringify(v, null, 2), { mode: 0o600 }); renameSync(tmp, localPath()); }

export interface PreferencesRead { preferences: AssistantPreferences; persisted: boolean }

export async function readAssistantPreferences(): Promise<PreferencesRead> {
  const ctx = await requireWorkspaceAccess();
  if (await isDemoGuestSession()) return { preferences: DEFAULT_PREFERENCES, persisted: false };
  if (isLocalAuth()) return { preferences: normalizePreferences(readLocal().users[ctx.actor.id]), persisted: true };
  const { data, error } = await adminClient().from('users').select('preferences').eq('id', ctx.actor.id).maybeSingle();
  if (error) return { preferences: DEFAULT_PREFERENCES, persisted: false }; // Defaults are safe; nothing is hidden.
  return { preferences: normalizePreferences((data?.preferences as Record<string, unknown> | null)?.assistant), persisted: true };
}

export async function writeAssistantPreferences(patch: unknown): Promise<AssistantPreferences> {
  const ctx = await requireWorkspaceAccess();
  const checked = validatePatch(patch);
  if (!checked.ok) throw new AccessError('INVALID_PREFERENCES', checked.reason);
  if (await isDemoGuestSession()) throw new AccessError('DEMO_GUEST', 'Preferences are not saved in the shared Demo session. They apply until you leave.');
  if (isLocalAuth()) {
    const file = readLocal();
    const next = mergePreferences(normalizePreferences(file.users[ctx.actor.id]), checked.patch);
    file.users[ctx.actor.id] = next; writeLocal(file); return next;
  }
  const { data, error } = await adminClient().rpc('set_assistant_preferences', { p_user_id: ctx.actor.id, p_patch: checked.patch });
  if (error) throw new Error('Your Ask Prodwise preferences could not be saved. Try again.');
  return normalizePreferences(data);
}
