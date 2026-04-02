'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-2xl">🎰</span>
            <span className="font-display text-2xl font-bold text-shimmer">CRAL</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-cral-text">Bon retour!</h1>
          <p className="text-cral-sub mt-2 text-sm">Connectez-vous pour voir vos Cral$</p>
        </div>

        <form onSubmit={handleLogin} className="card space-y-5">
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
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field pr-12"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-cral-muted hover:text-cral-sub transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
              <LogIn size={16} />
            )}
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <div className="text-center space-y-2">
            <Link href="/auth/forgot-password" className="text-xs text-cral-sub hover:text-gold-400 transition-colors">
              Mot de passe oublié?
            </Link>
            <div className="text-xs text-cral-muted">
              Pas de compte?{' '}
              <Link href="/auth/register" className="text-gold-400 hover:text-gold-300 transition-colors">
                Créer un compte
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
