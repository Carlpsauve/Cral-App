'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="font-display text-2xl font-bold text-cral-text mb-2">Courriel envoyé!</h2>
          <p className="text-cral-sub text-sm mb-6">
            Vérifiez votre boîte à <span className="text-gold-400">{email}</span> pour réinitialiser votre mot de passe.
          </p>
          <Link href="/auth/login" className="btn-outline text-sm">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-2xl">🎰</span>
            <span className="font-display text-2xl font-bold text-shimmer">CRAL</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-cral-text">Mot de passe oublié</h1>
          <p className="text-cral-sub mt-2 text-sm">On vous envoie un lien de réinitialisation</p>
        </div>

        <form onSubmit={handleReset} className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-field"
              placeholder="vous@exemple.com"
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
            ) : <Mail size={16} />}
            {loading ? 'Envoi...' : 'Envoyer le lien'}
          </button>

          <div className="text-center text-xs text-cral-muted">
            <Link href="/auth/login" className="text-gold-400 hover:text-gold-300 transition-colors">
              ← Retour à la connexion
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
