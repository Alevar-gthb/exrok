'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatIDR } from '@/lib/decimal'
import { topupPettyCashWallet } from '@/lib/actions/petty-cash-wallet.actions'
import type { PettyCashWalletEntry } from '@/types/database.types'

interface PettyCashWalletClientProps {
  balance: string
  entries: PettyCashWalletEntry[]
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: '8px',
  border: '1px solid #E2E8F0',
  fontSize: '13px',
  color: '#0F172A',
  background: '#fff',
}

export function PettyCashWalletClient({ balance, entries }: PettyCashWalletClientProps) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const parsedAmount = useMemo(() => Number(amount), [amount])
  const canSubmit = Number.isFinite(parsedAmount) && parsedAmount > 0

  async function onTopup() {
    if (!canSubmit) {
      setMsg({ type: 'error', text: 'Nominal top-up harus lebih besar dari 0' })
      return
    }

    setMsg(null)
    const result = await topupPettyCashWallet({ amount: String(parsedAmount), notes })
    if (!result.success || !result.data) {
      setMsg({ type: 'error', text: result.error ?? 'Gagal top-up wallet petty cash' })
      return
    }

    setAmount('')
    setNotes('')
    setMsg({
      type: 'success',
      text: `Top-up berhasil. Saldo: ${formatIDR(result.data.balance_before)} -> ${formatIDR(result.data.balance_after)}`,
    })
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div style={{ padding: '28px 32px', display: 'grid', gap: '16px' }}>
      <div style={{ background: '#fff', border: '1px solid #BBF7D0', borderRadius: '16px', padding: '22px 24px' }}>
        <p style={{ margin: 0, color: '#166534', fontWeight: 600, fontSize: '15px' }}>Total Disetujui</p>
        <h2 style={{ margin: '8px 0 2px', fontSize: '44px', lineHeight: 1.1, color: '#166534' }}>{formatIDR(balance)}</h2>
        <p style={{ margin: 0, color: '#15803D', fontSize: '13px' }}>Saldo wallet petty cash saat ini</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#0F172A' }}>Top-up Wallet</h3>
        <div style={{ display: 'grid', gap: '10px', maxWidth: '480px' }}>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Nominal top-up"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Catatan (opsional)"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <button
            type="button"
            onClick={() => void onTopup()}
            disabled={isPending || !canSubmit}
            style={{
              width: 'fit-content',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: isPending || !canSubmit ? '#94A3B8' : '#0F172A',
              color: '#fff',
              fontSize: '13px',
              cursor: isPending || !canSubmit ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Memproses...' : 'Tambah saldo'}
          </button>
          {msg && (
            <div
              style={{
                padding: '9px 11px',
                borderRadius: '8px',
                border: `1px solid ${msg.type === 'success' ? '#86EFAC' : '#FECACA'}`,
                background: msg.type === 'success' ? '#F0FDF4' : '#FEF2F2',
                color: msg.type === 'success' ? '#166534' : '#B91C1C',
                fontSize: '12px',
              }}
            >
              {msg.text}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: '#0F172A' }}>Riwayat Wallet</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Waktu</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Tipe</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Nominal</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Sebelum</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Sesudah</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: '#94A3B8' }}>
                    Belum ada transaksi wallet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#475569' }}>
                      {new Date(entry.created_at).toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          border: '1px solid #E2E8F0',
                          background: entry.entry_type === 'topup' ? '#ECFDF5' : '#FEF2F2',
                          color: entry.entry_type === 'topup' ? '#166534' : '#B91C1C',
                        }}
                      >
                        {entry.entry_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#0F172A' }}>
                      {formatIDR(entry.amount)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#64748B' }}>
                      {formatIDR(entry.balance_before)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#0F172A' }}>
                      {formatIDR(entry.balance_after)}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{entry.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
