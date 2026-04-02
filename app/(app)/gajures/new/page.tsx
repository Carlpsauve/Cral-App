'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { formatCral, getInitials } from '@/lib/utils'
import { Profile } from '@/types'
import { ArrowLeft, Plus, Users, User } from 'lucide-react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'

type GajureMode = 'solo' | 'team'

// For team mode: track which team each invited player is on
interface InvitedPlayer {
  profile: Profile
  team: 'A' | 'B'
}

export default function NewGajurePage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<GajureMode>('solo')
  const [myTeam, setMyTeam] = useState<'A' | 'B'>('A')
  const [players, setPlayers] = useState<Profile[]>([])
  const [invited, setInvited] = useState<InvitedPlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [myBalance, setMyBalance] = useState(0)
  const [myId, setMyId] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyId(user.id)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile) setMyBalance(profile.balance)
      const { data: allPlayers } = await supabase
        .from('profiles').select('*').neq('id', user.id).order('username')
      if (allPlayers) setPlayers(allPlayers)
    }
    load()
  }, [])

  function togglePlayer(player: Profile) {
    const exists = invited.find(i => i.profile.id === player.id)
    if (exists) {
      setInvited(prev => prev.filter(i => i.profile.id !== player.id))
    } else {
      // In solo mode everyone is on the same "side" (no teams)
      // In team mode, alternate or default to B
      setInvited(prev => [...prev, { profile: player, team: 'B' }])
    }
  }

  function setPlayerTeam(playerId: string, team: 'A' | 'B') {
    setInvited(prev => prev.map(i => i.profile.id === playerId ? { ...i, team } : i))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return setError('Montant invalide.')
    if (amt > myBalance) return setError('Solde insuffisant.')
    if (invited.length === 0) return setError('Ajoutez au moins un autre joueur.')

    if (mode === 'team') {
      const teamA = [myTeam === 'A' ? myId : null, ...invited.filter(i => i.team === 'A').map(i => i.profile.id)].filter(Boolean)
      const teamB = [myTeam === 'B' ? myId : null, ...invited.filter(i => i.team === 'B').map(i => i.profile.id)].filter(Boolean)
      if (teamA.length === 0 || teamB.length === 0) return setError('Chaque équipe doit avoir au moins 1 joueur.')
    }

    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: bet, error: betErr } = await supabase
      .from('bets')
      .insert({
        title,
        description: description || null,
        creator_id: user.id,
        amount: amt,
        is_team_bet: mode === 'team',
      })
      .select().single()

    if (betErr || !bet) {
      setError('Erreur lors de la création.')
      setLoading(false)
      return
    }

    // Add creator
    await supabase.from('bet_participants').insert({
      bet_id: bet.id,
      user_id: user.id,
      accepted: true,
      team: mode === 'team' ? myTeam : null,
    })

    // Add invited players
    if (invited.length > 0) {
      await supabase.from('bet_participants').insert(
        invited.map(i => ({
          bet_id: bet.id,
          user_id: i.profile.id,
          accepted: false,
          team: mode === 'team' ? i.team : null,
        }))
      )
    }

    router.push(`/gajures/${bet.id}`)
  }

  const amt = parseFloat(amount || '0')
  const totalPlayers = invited.length + 1
  const totalPool = isNaN(amt) ? 0 : amt * totalPlayers

  const teamA = [{ id: myId, team: myTeam }, ...invited.map(i => ({ id: i.profile.id, team: i.team }))].filter(i => i.team === 'A')
  const teamB = [{ id: myId, team: myTeam }, ...invited.map(i => ({ id: i.profile.id, team: i.team }))].filter(i => i.team === 'B')

  const allInvited = invited.map(i => i.profile)

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/gajures" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-cral-card transition-colors text-cral-sub">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text">Nouvelle gajure</h1>
          <p className="text-cral-sub text-sm mt-1">Solo ou par équipes</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setMode('solo')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border ${
              mode === 'solo'
                ? 'bg-gold-400/15 border-gold-400/40 text-gold-400'
                : 'border-cral-border text-cral-sub hover:border-cral-muted'
            }`}>
            <User size={16} />
            Gajure solo
          </button>
          <button type="button" onClick={() => setMode('team')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border ${
              mode === 'team'
                ? 'bg-blue-400/15 border-blue-400/40 text-blue-300'
                : 'border-cral-border text-cral-sub hover:border-cral-muted'
            }`}>
            <Users size={16} />
            Gajure par équipes
          </button>
        </div>

        <div className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">Titre</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="input-field" placeholder="ex: Qui gagne à Catan ce soir?" maxLength={100} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">
              Description <span className="text-cral-muted">(optionnel)</span>
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="input-field resize-none" rows={2} placeholder="Règles, contexte..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-cral-sub mb-2">
              Mise par joueur
              <span className="text-cral-muted ml-2">solde: ₡{formatCral(myBalance)}</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold-400 font-mono font-medium">₡</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="input-field pl-8" placeholder="0.00"
                min="0.01" max={myBalance} step="0.01" required />
            </div>
            {totalPool > 0 && (
              <div className="text-xs text-cral-sub mt-2">
                Cagnotte totale: <span className="text-gold-400 font-mono font-medium">₡{formatCral(totalPool)}</span>
                {mode === 'team' && teamA.length > 0 && teamB.length > 0 && (
                  <span className="ml-2 text-cral-muted">
                    · Gagnants équipe A reçoivent ₡{formatCral((amt * totalPlayers) / teamA.length)} chacun
                    · Gagnants équipe B reçoivent ₡{formatCral((amt * totalPlayers) / teamB.length)} chacun
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* My team selector (team mode only) */}
        {mode === 'team' && (
          <div className="card space-y-3">
            <div className="text-sm font-medium text-cral-text">Votre équipe</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMyTeam('A')}
                className={`py-2.5 rounded-xl font-bold text-sm transition-all border ${
                  myTeam === 'A' ? 'bg-blue-400/20 border-blue-400/50 text-blue-300' : 'border-cral-border text-cral-sub hover:border-cral-muted'
                }`}>
                🔵 Équipe A
              </button>
              <button type="button" onClick={() => setMyTeam('B')}
                className={`py-2.5 rounded-xl font-bold text-sm transition-all border ${
                  myTeam === 'B' ? 'bg-red-400/20 border-red-400/50 text-red-300' : 'border-cral-border text-cral-sub hover:border-cral-muted'
                }`}>
                🔴 Équipe B
              </button>
            </div>
          </div>
        )}

        {/* Player selection */}
        <div className="card space-y-4">
          <div>
            <div className="text-sm font-medium text-cral-text mb-1">
              {mode === 'team' ? 'Assigner les joueurs aux équipes' : 'Joueurs invités'}
            </div>
            <div className="text-xs text-cral-sub">
              {mode === 'team'
                ? 'Cliquez pour inviter, puis choisissez l\'équipe de chaque joueur'
                : 'Sélectionnez les joueurs participants'}
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {players.map(player => {
              const inv = invited.find(i => i.profile.id === player.id)
              const isSelected = !!inv
              return (
                <div key={player.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border ${
                    isSelected ? 'border-gold-400/30 bg-gold-400/5' : 'border-transparent hover:bg-cral-surface'
                  }`}>
                  {/* Click to toggle */}
                  <button type="button" onClick={() => togglePlayer(player)}
                    className="flex items-center gap-3 flex-1 text-left">
                    <Avatar username={player.username} avatarColor={player.avatar_color} avatarSvg={player.avatar_svg} size={32} />
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

                  {/* Team selector (team mode only, when selected) */}
                  {mode === 'team' && isSelected && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button type="button"
                        onClick={() => setPlayerTeam(player.id, 'A')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          inv?.team === 'A' ? 'bg-blue-400/30 text-blue-300 border border-blue-400/50' : 'bg-cral-surface text-cral-muted hover:text-cral-sub'
                        }`}>A</button>
                      <button type="button"
                        onClick={() => setPlayerTeam(player.id, 'B')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          inv?.team === 'B' ? 'bg-red-400/30 text-red-300 border border-red-400/50' : 'bg-cral-surface text-cral-muted hover:text-cral-sub'
                        }`}>B</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Team preview */}
          {mode === 'team' && invited.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-cral-border">
              <div>
                <div className="text-xs font-medium text-blue-400 mb-2">🔵 Équipe A ({teamA.length})</div>
                <div className="space-y-1">
                  {myTeam === 'A' && <div className="text-xs text-cral-sub bg-blue-400/10 rounded px-2 py-1">Vous</div>}
                  {invited.filter(i => i.team === 'A').map(i => (
                    <div key={i.profile.id} className="text-xs text-cral-sub bg-blue-400/10 rounded px-2 py-1">{i.profile.username}</div>
                  ))}
                  {teamA.length === 0 && <div className="text-xs text-cral-muted italic">Vide</div>}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-red-400 mb-2">🔴 Équipe B ({teamB.length})</div>
                <div className="space-y-1">
                  {myTeam === 'B' && <div className="text-xs text-cral-sub bg-red-400/10 rounded px-2 py-1">Vous</div>}
                  {invited.filter(i => i.team === 'B').map(i => (
                    <div key={i.profile.id} className="text-xs text-cral-sub bg-red-400/10 rounded px-2 py-1">{i.profile.username}</div>
                  ))}
                  {teamB.length === 0 && <div className="text-xs text-cral-muted italic">Vide</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</div>
        )}

        <button type="submit" disabled={loading}
          className="btn-gold w-full flex items-center justify-center gap-2 py-3 text-base">
          {loading ? <span className="w-4 h-4 border-2 border-cral-bg/30 border-t-cral-bg rounded-full animate-spin" /> : <Plus size={18} />}
          {loading ? 'Création...' : 'Créer la gajure'}
        </button>
      </form>
    </div>
  )
}
