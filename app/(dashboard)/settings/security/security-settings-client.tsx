'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/supabase/client'
import { validatePasswordStrength } from '@/lib/password-policy'

export function SecuritySettingsClient({ email }: { email: string }) {
  const supabase = createClient()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email) {
      setError('Email akun tidak ditemukan. Hubungi owner.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak sama.')
      return
    }
    const passwordError = validatePasswordStrength(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setSaving(true)
    const reauth = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (reauth.error) {
      setSaving(false)
      setError('Password saat ini salah.')
      return
    }

    const update = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (update.error) {
      setError('Gagal mengganti password. Coba lagi.')
      return
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSuccess('Password berhasil diperbarui.')
  }

  return (
    <div style={{ maxWidth: '520px' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#0F172A' }}>Ubah Password</h2>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748B' }}>
        Gunakan kombinasi minimal 8 karakter dengan huruf besar-kecil dan angka.
      </p>

      <form onSubmit={onSubmit} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
            Password saat ini
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
            Password baru
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
            Konfirmasi password baru
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}
          />
        </div>

        {error && <p style={{ color: '#B91C1C', fontSize: '12px', margin: '0 0 10px' }}>{error}</p>}
        {success && <p style={{ color: '#047857', fontSize: '12px', margin: '0 0 10px' }}>{success}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: 500,
              background: saving ? '#94A3B8' : '#0F172A',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Menyimpan...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  )
}
