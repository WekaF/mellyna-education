'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setMessage(null)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? 'Terjadi kesalahan. Coba lagi.')
      } else {
        setStatus('success')
        setMessage(data.message)
      }
    } catch {
      setStatus('error')
      setMessage('Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-slate-50 to-indigo-50/60 dark:from-[#151f32] dark:to-[#0f172a] p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#1e293b]/60 dark:backdrop-blur-md p-8 shadow-xl transition-all duration-300 hover:shadow-2xl border border-slate-100 dark:border-slate-800/40 text-slate-800 dark:text-white">

        {/* Header */}
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
            Lupa Kata Sandi?
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Masukkan email kamu dan kami akan mengirim link untuk reset kata sandi.
          </p>
        </div>

        {/* Success State */}
        {status === 'success' ? (
          <div className="mt-6">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-6 text-center border border-emerald-100 dark:border-emerald-500/10">
              <span className="text-3xl">📧</span>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{message}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Periksa folder spam jika email tidak masuk dalam beberapa menit.
              </p>
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm text-[#1A56DB] hover:text-[#2B6EF5] dark:text-[#2B6EF5] font-medium transition-colors"
              >
                ← Kembali ke halaman login
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Error Alert */}
            {status === 'error' && message && (
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/10">
                <span className="text-base font-semibold">⚠️</span>
                <span>{message}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Alamat Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  disabled={status === 'loading'}
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/35 px-4 py-3 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-[#1A56DB] dark:focus:border-[#2B6EF5] focus:bg-white dark:focus:bg-[#151f32]/50 focus:ring-2 focus:ring-[#1A56DB]/10 disabled:opacity-50"
                />
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
                    <span>Mengirim...</span>
                  </div>
                ) : (
                  <span>Kirim Link Reset</span>
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

        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} Mellyna Education. All rights reserved.
        </div>
      </div>
    </div>
  )
}
