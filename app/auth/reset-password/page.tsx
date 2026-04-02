'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { KeyRound } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <span className="text-2xl">🔑</span>
          <h1 className="font-display text-3xl font-bold text-cral-text mt-4">Nouveau mot de passe</h1>
          <p className="text-cral-sub mt-2 text-sm">Choisissez un nouveau mot de passe sécurisé</p>
        </div>

        <form onSubmit={handleReset} className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">Nouveau mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-field"
              placeholder="Min. 8 caractères"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">Confirmer</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="input-field"
              placeholder="Répétez le mot de passe"
              minLength={8}
              required
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-gold w-full flex items-center justify-center gap-2 py-3">
            {loading ? (
              <span className="w-4 h-4 border-2 border-cral-bg/30 border-t-cral-bg rounded-full animate-spin" />
            ) : <KeyRound size={16} />}
            {loading ? 'Mise à jour...' : 'Mettre à jour'}
          </button>
        </form>
      </div>
    </div>
  )
}
