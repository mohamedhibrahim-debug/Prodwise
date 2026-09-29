/**
 * Ask Prodwise preferences — the model, validation and merge. Pure.
 *
 * Four personal settings per user, kept across devices (decision D8):
 * `show` (the control is visible), `language` (Auto / English / Arabic),
 * `openBehaviour` (remember the last open state or start collapsed) and
 * `proactive` (a quiet badge when a recommendation appears). Nothing here is
 * a product record, and none of it changes what other people see.
 */
export const PREFERENCE_LANGUAGES = ['auto', 'en', 'ar'] as const;
export const OPEN_BEHAVIOURS = ['remember', 'collapsed'] as const;
export interface AssistantPreferences { show: boolean; language: typeof PREFERENCE_LANGUAGES[number]; openBehaviour: typeof OPEN_BEHAVIOURS[number]; proactive: boolean }
export const DEFAULT_PREFERENCES: AssistantPreferences = { show: true, language: 'auto', openBehaviour: 'remember', proactive: false };
export const PREFERENCE_KEYS = Object.keys(DEFAULT_PREFERENCES) as (keyof AssistantPreferences)[];

/** Whatever was stored, read back safely: unknown keys are ignored, bad values fall back to the default. */
export function normalizePreferences(value: unknown): AssistantPreferences {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    show: typeof v.show === 'boolean' ? v.show : DEFAULT_PREFERENCES.show,
    language: (PREFERENCE_LANGUAGES as readonly unknown[]).includes(v.language) ? v.language as AssistantPreferences['language'] : DEFAULT_PREFERENCES.language,
    openBehaviour: (OPEN_BEHAVIOURS as readonly unknown[]).includes(v.openBehaviour) ? v.openBehaviour as AssistantPreferences['openBehaviour'] : DEFAULT_PREFERENCES.openBehaviour,
    proactive: typeof v.proactive === 'boolean' ? v.proactive : DEFAULT_PREFERENCES.proactive,
  };
}

/** A patch may name any subset of the four keys; anything else is refused so a typo cannot silently do nothing. */
export function validatePatch(value: unknown): { ok: true; patch: Partial<AssistantPreferences> } | { ok: false; reason: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, reason: 'Preferences must be an object.' };
  const v = value as Record<string, unknown>, patch: Partial<AssistantPreferences> = {};
  for (const key of Object.keys(v)) {
    if (!(PREFERENCE_KEYS as string[]).includes(key)) return { ok: false, reason: `Unknown preference "${key}".` };
    const x = v[key];
    if (key === 'show' || key === 'proactive') { if (typeof x !== 'boolean') return { ok: false, reason: `${key} must be true or false.` }; patch[key] = x; }
    if (key === 'language') { if (!(PREFERENCE_LANGUAGES as readonly unknown[]).includes(x)) return { ok: false, reason: 'language must be auto, en or ar.' }; patch.language = x as AssistantPreferences['language']; }
    if (key === 'openBehaviour') { if (!(OPEN_BEHAVIOURS as readonly unknown[]).includes(x)) return { ok: false, reason: 'openBehaviour must be remember or collapsed.' }; patch.openBehaviour = x as AssistantPreferences['openBehaviour']; }
  }
  if (!Object.keys(patch).length) return { ok: false, reason: 'Nothing to change.' };
  return { ok: true, patch };
}

export const mergePreferences = (current: AssistantPreferences, patch: Partial<AssistantPreferences>): AssistantPreferences => normalizePreferences({ ...current, ...patch });
