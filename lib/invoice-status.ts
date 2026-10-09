export const PAYABLE_STATUSES = ['PENDING', 'OVERDUE'] as const

export function isPayable(status: string): boolean {
  return (PAYABLE_STATUSES as readonly string[]).includes(status)
}
