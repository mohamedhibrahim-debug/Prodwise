'use server';
import { revalidatePath } from 'next/cache';
import { getRepository } from '@/lib/data';
import { assertFormWorkspace } from '@/lib/auth/scope';
import { freshContextForRequest } from '@/lib/auth/service';
import { configureAutoSync } from '@/lib/connectors/auto-sync';
import { ConnectorError, connectorMessage } from '@/lib/connectors/types';
import { safeMessage } from '@/lib/errors/safe-message';

export async function autoSyncAction(_previous: { error: string | null; message: string | null }, form: FormData): Promise<{ error: string | null; message: string | null }> {
  try {
    assertFormWorkspace(form, await freshContextForRequest());
    const slug = String(form.get('slug') ?? ''), itemId = String(form.get('itemId') ?? '');
    const revision = Number(form.get('revision'));
    if (!Number.isSafeInteger(revision) || revision < 0 || !itemId) throw new Error('Reload the source before changing sync settings.');
    const initiative = await getRepository().getInitiativeBySlug(slug);
    if (!initiative) throw new Error('This initiative is unavailable.');
    const enabled = form.get('enabled') === 'on';
    await configureAutoSync(initiative.id, itemId, enabled, revision);
    revalidatePath(`/initiatives/${slug}/sources`);
    revalidatePath(`/initiatives/${slug}/knowledge/sources`);
    return { error: null, message: enabled ? 'Background sync enabled for your connected account.' : 'Background sync paused.' };
  } catch (error) {
    return { error: error instanceof ConnectorError ? connectorMessage(error.code, 'JIRA') : safeMessage(error, 'Sync settings could not be saved.'), message: null };
  }
}
