'use client'

// ============================================================
// app/(auth)/login/page.tsx
// Halaman login Exrok — Supabase Email Auth
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/supabase/client'

type Mode = 'login' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email atau password salah. Coba lagi.')
      setLoading(false)
      return
    }

    router.replace('/expenses')
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError('Gagal mengirim email. Coba lagi.')
    } else {
      setInfo('Link reset password telah dikirim ke email Anda.')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F7F7F8',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '44px', height: '44px', borderRadius: '12px',
            background: '#0F172A', marginBottom: '16px',
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M4 17L11 4L18 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6.5 13h9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', margin: '0 0 4px' }}>
            Exrok
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
            {mode === 'login' ? 'Masuk ke akun Anda' : 'Reset password'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <form onSubmit={mode === 'login' ? handleLogin : handleForgot}>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nama@roketin.com"
                required
                style={{
                  width: '100%', padding: '9px 12px', fontSize: '14px',
                  border: '1px solid #E2E8F0', borderRadius: '8px',
                  outline: 'none', color: '#0F172A', background: '#fff',
                  transition: 'border-color .15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#94A3B8')}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>

            {/* Password — hanya saat login */}
            {mode === 'login' && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); setInfo(null) }}
                    style={{ fontSize: '12px', color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Lupa password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '9px 12px', fontSize: '14px',
                    border: '1px solid #E2E8F0', borderRadius: '8px',
                    outline: 'none', color: '#0F172A', background: '#fff',
                    transition: 'border-color .15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#94A3B8')}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>
            )}

            {/* Error / Info */}
            {error && (
              <div style={{
                padding: '10px 12px', borderRadius: '8px', marginBottom: '16px',
                background: '#FEF2F2', border: '1px solid #FECACA',
                fontSize: '13px', color: '#B91C1C',
              }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{
                padding: '10px 12px', borderRadius: '8px', marginBottom: '16px',
                background: '#F0FDF4', border: '1px solid #BBF7D0',
                fontSize: '13px', color: '#166534',
              }}>
                {info}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '10px', fontSize: '14px', fontWeight: '500',
                background: loading ? '#94A3B8' : '#0F172A', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Kirim Link Reset'}
            </button>

          </form>

          {mode === 'forgot' && (
            <button
              onClick={() => { setMode('login'); setError(null); setInfo(null) }}
              style={{
                marginTop: '14px', width: '100%', padding: '8px', fontSize: '13px',
                color: '#64748B', background: 'none', border: '1px solid #E2E8F0',
                borderRadius: '8px', cursor: 'pointer',
              }}
            >
              ← Kembali ke login
            </button>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#94A3B8', marginTop: '20px' }}>
          Exrok · Roketin & Spacehub Internal System
        </p>
      </div>
    </div>
  )
}
