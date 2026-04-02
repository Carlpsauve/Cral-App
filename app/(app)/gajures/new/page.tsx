'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { formatCral } from '@/lib/utils'
import { Profile } from '@/types'
import { ArrowLeft, Plus, X } from 'lucide-react'
import Link from 'next/link'

export default function NewGajurePage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [players, setPlayers] = useState<Profile[]>([])
  const [selectedPlayers, setSelectedPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [myBalance, setMyBalance] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile) setMyBalance(profile.balance)
      const { data: allPlayers } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .order('username')
      if (allPlayers) setPlayers(allPlayers)
    }
    load()
  }, [])

  function togglePlayer(player: Profile) {
    setSelectedPlayers(prev =>
      prev.find(p => p.id === player.id)
        ? prev.filter(p => p.id !== player.id)
        : [...prev, player]
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return setError('Montant invalide.')
    if (amt > myBalance) return setError('Solde insuffisant.')
    if (selectedPlayers.length === 0) return setError('Ajoutez au moins un autre joueur.')

    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: bet, error: betErr } = await supabase
      .from('bets')
      .insert({ title, description: description || null, creator_id: user.id, amount: amt })
      .select()
      .single()

    if (betErr || !bet) {
      setError('Erreur lors de la création.')
      setLoading(false)
      return
    }

    // Add creator + selected players as participants
    const participants = [
      { bet_id: bet.id, user_id: user.id, accepted: true },
      ...selectedPlayers.map(p => ({ bet_id: bet.id, user_id: p.id, accepted: false })),
    ]
    await supabase.from('bet_participants').insert(participants)

    router.push(`/gajures/${bet.id}`)
  }

  const totalPool = selectedPlayers.length > 0
    ? parseFloat(amount || '0') * (selectedPlayers.length + 1)
    : 0

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/gajures" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-cral-card transition-colors text-cral-sub">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text">Nouvelle gajure</h1>
          <p className="text-cral-sub text-sm mt-1">Défiez vos amis sur une partie</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-6">
        <div className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">Titre de la gajure</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="input-field"
              placeholder="ex: Qui va gagner à Catan ce soir?"
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">Description <span className="text-cral-muted">(optionnel)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder="Règles, détails de la mise..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">
              Mise par joueur
              <span className="text-cral-muted ml-2">(solde: ₡{formatCral(myBalance)})</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-400 font-mono font-medium">₡</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="input-field pl-8"
                placeholder="0.00"
                min="0.01"
                max={myBalance}
                step="0.01"
                required
              />
            </div>
            {totalPool > 0 && (
              <div className="text-xs text-cral-sub mt-2">
                Cagnotte totale estimée: <span className="text-gold-400 font-mono font-medium">₡{formatCral(totalPool)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Player selection */}
        <div className="card space-y-4">
          <div>
            <div className="text-sm font-medium text-cral-text mb-1">Joueurs invités</div>
            <div className="text-xs text-cral-sub">Sélectionnez les joueurs qui participent à la gajure</div>
          </div>

          {selectedPlayers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedPlayers.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-gold-400/10 border border-gold-400/20 rounded-full px-3 py-1">
                  <div className="w-4 h-4 rounded-full flex-shrink-0 text-[8px] flex items-center justify-center font-bold text-cral-bg"
                    style={{ backgroundColor: p.avatar_color }}>
                    {p.username[0].toUpperCase()}
                  </div>
                  <span className="text-xs text-gold-400">{p.username}</span>
                  <button type="button" onClick={() => togglePlayer(p)} className="text-gold-600 hover:text-gold-400 ml-1">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {players.map(player => {
              const isSelected = selectedPlayers.some(p => p.id === player.id)
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => togglePlayer(player)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left ${
                    isSelected
                      ? 'bg-gold-400/10 border border-gold-400/30'
                      : 'border border-transparent hover:bg-cral-card'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-cral-bg flex-shrink-0"
                    style={{ backgroundColor: player.avatar_color }}
                  >
                    {player.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-cral-text">{player.username}</div>
                    <div className="text-xs text-cral-sub">₡{formatCral(player.balance)}</div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="#0a0a0f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-gold w-full flex items-center justify-center gap-2 py-3 text-base">
          {loading ? (
            <span className="w-4 h-4 border-2 border-cral-bg/30 border-t-cral-bg rounded-full animate-spin" />
          ) : <Plus size={18} />}
          {loading ? 'Création...' : 'Créer la gajure'}
        </button>
      </form>
    </div>
  )
}
