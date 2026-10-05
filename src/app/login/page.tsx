'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase/browser'
import { getManagerAuthEmail } from '../../../shared/auth/manager'

export default function LoginPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const email = getManagerAuthEmail(userId)
      if (!email) throw new Error('User ID atau kata sandi tidak cocok')
      const client = createBrowserSupabase()
      const result = await client.auth.signInWithPassword({ email, password })
      if (result.error) throw new Error('User ID atau kata sandi tidak cocok')
      const access = await fetch('/api/auth/me', { cache: 'no-store' })
      if (!access.ok) {
        await client.auth.signOut()
        throw new Error(access.status === 403 ? 'Akun ini belum diberi akses manajer' : 'Akses manajer belum tersedia')
      }
      router.replace('/')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login gagal. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-emerald-700">HATO Manajer</p>
        <h1 className="mt-2 text-2xl font-semibold">Masuk</h1>
        <p className="mt-1 text-sm text-slate-600">Gunakan akun manajer untuk membuka data operasional.</p>
        <form onSubmit={signIn} className="mt-6 space-y-4">
          <label className="block text-sm font-medium" htmlFor="user-id">User ID</label>
          <input id="user-id" type="text" autoComplete="username" autoCapitalize="none" required value={userId} onChange={(event) => setUserId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2" />
          <label className="block text-sm font-medium" htmlFor="password">Kata sandi</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2" />
          {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60">{loading ? 'Memeriksa akun…' : 'Masuk'}</button>
        </form>
      </div>
    </main>
  )
}
