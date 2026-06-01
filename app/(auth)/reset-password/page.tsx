'use client'

import React, { useState, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-6 text-center border border-rose-100 dark:border-rose-500/10">
        <span className="text-3xl">⚠️</span>
        <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">
          Link reset tidak valid. Silakan minta link baru.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-[#1A56DB] hover:text-[#2B6EF5] font-medium transition-colors"
        >
          Kirim ulang link reset
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (password !== confirm) {
      setStatus('error')
      setMessage('Konfirmasi kata sandi tidak cocok.')
      return
    }

    if (password.length < 8) {
      setStatus('error')
      setMessage('Kata sandi minimal 8 karakter.')
      return
    }

    setStatus('loading')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? 'Terjadi kesalahan. Coba lagi.')
      } else {
        setStatus('success')
        setMessage(data.message)
        setTimeout(() => router.push('/login'), 2500)
      }
    } catch {
      setStatus('error')
      setMessage('Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.')
    }
  }

  return (
    <>
      {status === 'success' ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-6 text-center border border-emerald-100 dark:border-emerald-500/10">
          <span className="text-3xl">✅</span>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{message}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mengarahkan ke halaman login...
          </p>
        </div>
      ) : (
        <>
          {status === 'error' && message && (
            <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/10">
              <span className="text-base font-semibold">⚠️</span>
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Kata Sandi Baru
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  disabled={status === 'loading'}
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/35 px-4 py-3 pr-12 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-[#1A56DB] dark:focus:border-[#2B6EF5] focus:bg-white dark:focus:bg-[#151f32]/50 focus:ring-2 focus:ring-[#1A56DB]/10 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={status === 'loading'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:pointer-events-none"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Konfirmasi Kata Sandi
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  disabled={status === 'loading'}
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/35 px-4 py-3 pr-12 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-[#1A56DB] dark:focus:border-[#2B6EF5] focus:bg-white dark:focus:bg-[#151f32]/50 focus:ring-2 focus:ring-[#1A56DB]/10 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  disabled={status === 'loading'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:pointer-events-none"
                  aria-label={showConfirm ? 'Sembunyikan konfirmasi' : 'Tampilkan konfirmasi'}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="relative flex w-full justify-center rounded-xl bg-[#1A56DB] px-4 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#0C1A5C] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB] focus:ring-offset-2 disabled:bg-[#1A56DB]/50 cursor-pointer active:scale-95 disabled:pointer-events-none"
            >
              {status === 'loading' ? (
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Memproses...</span>
                </div>
              ) : (
                <span>Ubah Kata Sandi</span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-[#1A56DB] hover:text-[#2B6EF5] dark:text-[#2B6EF5] font-medium transition-colors"
            >
              ← Kembali ke halaman login
            </Link>
          </div>
        </>
      )}
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-slate-50 to-indigo-50/60 dark:from-[#151f32] dark:to-[#0f172a] p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#1e293b]/60 dark:backdrop-blur-md p-8 shadow-xl transition-all duration-300 hover:shadow-2xl border border-slate-100 dark:border-slate-800/40 text-slate-800 dark:text-white">

        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A56DB]/5 dark:bg-[#1A56DB]/10 shadow-sm border border-[#1A56DB]/10 dark:border-[#1A56DB]/20">
              <Image
                src="/icons/mellyna-icon-192.svg"
                alt="Mellyna Education"
                width={48}
                height={48}
                priority
              />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            Buat Kata Sandi Baru
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Masukkan kata sandi baru untuk akun kamu.
          </p>
        </div>

        <Suspense fallback={<div className="mt-6 text-center text-slate-400">Memuat...</div>}>
          <ResetPasswordForm />
        </Suspense>

        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} Mellyna Education. All rights reserved.
        </div>
      </div>
    </div>
  )
}
