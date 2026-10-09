// ADMIN hanya boleh kelola akun TUTOR & PARENT; akun ADMIN/SUPER_ADMIN hanya oleh SUPER_ADMIN.
export function canManageUser(actorRole: string | undefined, targetRole: string): boolean {
  if (actorRole === 'SUPER_ADMIN') return true
  if (actorRole === 'ADMIN') return targetRole === 'TUTOR' || targetRole === 'PARENT'
  return false
}
