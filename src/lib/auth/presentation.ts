import 'server-only';
import { requireWorkspaceAccess } from './access';
import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from '@/lib/env';
/** UI explanation only. Fresh server authorization remains mandatory on writes. */
export async function businessWritePresentation() {
  const access = await requireWorkspaceAccess();
  const viewOnly = access.role === 'Viewer';
  return { enabled: !viewOnly && isDemoWriteEnabled,
    message: viewOnly ? 'Your Viewer role has read-only access.' : WRITE_DISABLED_MESSAGE };
}
