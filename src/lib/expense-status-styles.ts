// Badge styles untuk status expense — dipakai list & detail
export const EXPENSE_STATUS_STYLE: Record<
  string,
  { bg: string; color: string; border: string; label: string }
> = {
  Draft: { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0', label: 'Draft' },
  'Pending Approval': { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D', label: 'Menunggu' },
  Approved: { bg: '#F0FDF4', color: '#166534', border: '#86EFAC', label: 'Disetujui' },
  Rejected: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA', label: 'Ditolak' },
  Paid: { bg: '#ECFEFF', color: '#0E7490', border: '#67E8F9', label: 'Dibayar' },
}
