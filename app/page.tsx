export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#fbbf24 1px, transparent 1px), linear-gradient(90deg, #fbbf24 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      {/* Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.07) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 text-center max-w-2xl w-full">
        {/* Logo */}
        <div className="mb-10 inline-flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-3xl">
            🎰
          </div>
          <span className="font-display text-5xl font-bold text-shimmer tracking-tight">CRAL</span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold text-cral-text mb-4 leading-tight">
          La monnaie des soirées de jeux
        </h1>
        <p className="text-cral-sub text-base sm:text-lg mb-10 leading-relaxed">
          Comptabilisez vos gajures avec vos amis en Cral dollars.
          <br className="hidden sm:block" />
          Chaque joueur commence avec{' '}
          <span className="text-gold-400 font-mono font-semibold">₡100</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Link href="/auth/register" className="btn-gold text-base px-10 py-3 text-center">
            Créer un compte
          </Link>
          <Link href="/auth/login" className="btn-outline text-base px-10 py-3 text-center">
            Se connecter
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '🎲', title: 'Gajures', desc: 'Pariez sur vos parties entre amis avec un système de vote' },
            { icon: '🎰', title: 'Daily Game', desc: 'Machine à sous quotidienne · Reset à minuit (Montréal)' },
            { icon: '🏆', title: 'Classement', desc: 'Qui domine les soirées? Suivez le classement en temps réel' },
          ].map(f => (
            <div key={f.title} className="card text-left">
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="text-sm font-semibold text-cral-text mb-1">{f.title}</div>
              <div className="text-xs text-cral-sub leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
