/**
 * Named admin staff for commerce ops.
 *
 * Env MIRA_ADMIN_STAFF entries: id:role:secret
 *   role = support | supervisor
 * Example:
 *   MIRA_ADMIN_STAFF=ops.support:support:supReadKey,ops.sara:supervisor:supWriteKey
 *
 * Master ADMIN_API_KEY still works as shared key (role=shared, actor=admin-key or X-Admin-Actor label only).
 * Staff secrets bind the actor id: the key itself proves who is acting — X-Admin-Actor cannot impersonate another staff.
 */

export type AdminRole = 'support' | 'supervisor' | 'shared';

export type AdminStaffRecord = {
  id: string;
  role: AdminRole;
  secret: string;
};

export type ResolvedAdminSession = {
  actorId: string;
  role: AdminRole;
  canMutate: boolean;
  source: 'staff-secret' | 'shared-key';
};

function parseStaffEnv(raw: string | undefined | null): AdminStaffRecord[] {
  if (!raw || !raw.trim()) return [];
  const out: AdminStaffRecord[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [id, role, secret] = trimmed.split(':').map((s) => s.trim());
    if (!id || !role || !secret) continue;
    if (!/^[A-Za-z0-9_.:@-]{2,64}$/.test(id)) continue;
    if (role !== 'support' && role !== 'supervisor') continue;
    out.push({ id, role, secret });
  }
  return out;
}

export function loadAdminStaff(env: NodeJS.ProcessEnv = process.env): AdminStaffRecord[] {
  return parseStaffEnv(env.MIRA_ADMIN_STAFF);
}

export function resolveAdminSession(params: {
  key: string;
  actorHeader?: string | null;
  masterKey: string;
  staff: AdminStaffRecord[];
}): ResolvedAdminSession | null {
  const { key, actorHeader, masterKey, staff } = params;
  const bySecret = staff.find((s) => s.secret === key);
  if (bySecret) {
    return {
      actorId: bySecret.id,
      role: bySecret.role,
      canMutate: bySecret.role === 'supervisor',
      source: 'staff-secret',
    };
  }
  if (key === masterKey) {
    const labeled =
      typeof actorHeader === 'string' && /^[A-Za-z0-9_.:@-]{2,64}$/.test(actorHeader.trim())
        ? actorHeader.trim()
        : 'admin-key';
    // Shared master key: may label actor for display, but role stays shared (full mutate).
    // Prefer staff secrets for real attribution.
    return {
      actorId: labeled,
      role: 'shared',
      canMutate: true,
      source: 'shared-key',
    };
  }
  return null;
}
