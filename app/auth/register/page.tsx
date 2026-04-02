'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { UserPlus } from 'lucide-react'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (username.length < 3) {
      setError('Le nom d\'utilisateur doit faire au moins 3 caractères.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🎉</div>
          <h2 className="font-display text-2xl font-bold text-cral-text mb-2">Bienvenue!</h2>
          <p className="text-cral-sub text-sm">
            Votre compte a été créé avec <span className="text-gold-400 font-mono font-medium">₡100</span> de départ.
          </p>
          <p className="text-cral-muted text-xs mt-2">Redirection en cours...</p>
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
          <h1 className="font-display text-3xl font-bold text-cral-text">Créer un compte</h1>
          <p className="text-cral-sub mt-2 text-sm">
            Recevez <span className="text-gold-400 font-mono font-medium">₡100</span> de départ
          </p>
        </div>

        <form onSubmit={handleRegister} className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">Nom d&apos;utilisateur</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="input-field"
              placeholder="votre_pseudo"
              minLength={3}
              required
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">Mot de passe</label>
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

          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full flex items-center justify-center gap-2 py-3"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-cral-bg/30 border-t-cral-bg rounded-full animate-spin" />
            ) : (
              <UserPlus size={16} />
            )}
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>

          <div className="text-center text-xs text-cral-muted">
            Déjà un compte?{' '}
            <Link href="/auth/login" className="text-gold-400 hover:text-gold-300 transition-colors">
              Se connecter
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
