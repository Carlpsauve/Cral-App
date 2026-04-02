'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { formatCral, formatDate, getStatusLabel, getStatusColor, cn } from '@/lib/utils'
import { ArrowLeft, Trophy, Vote, CheckCircle, Shield, Clock, XCircle, MessageSquare, RotateCcw, Users, User } from 'lucide-react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'

export default function GajureDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [bet, setBet] = useState<any>(null)
  const [cancelVotes, setCancelVotes] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [votingFor, setVotingFor] = useState<string>('') // player id (solo) or 'A'/'B' (team)
  const [prediction, setPrediction] = useState('')
  const [myAcceptTeam, setMyAcceptTeam] = useState<'A' | 'B'>('A')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()
  const resolving = useRef(false)
  const cancelling = useRef(false)

  const loadBet = useCallback(async () => {
    const { data } = await supabase
      .from('bets')
      .select(`
        *,
        creator:profiles!bets_creator_id_fkey(id, username, avatar_color, avatar_svg),
        winner:profiles!bets_winner_id_fkey(id, username, avatar_color, avatar_svg),
        participants:bet_participants(
          id, user_id, accepted, prediction, team,
          profile:profiles(id, username, avatar_color, avatar_svg)
        ),
        votes:bet_votes(
          id, voter_id, voted_for_id,
          voter:profiles!bet_votes_voter_id_fkey(id, username),
          voted_for:profiles!bet_votes_voted_for_id_fkey(id, username)
        )
      `)
      .eq('id', id)
      .single()
    if (data) setBet(data)

    const { data: cv } = await supabase
      .from('bet_cancel_votes')
      .select('id, voter_id, voter:profiles!bet_cancel_votes_voter_id_fkey(id, username)')
      .eq('bet_id', id)
    setCancelVotes(cv ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUser(user)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      await loadBet()
    }
    init()

    const channel = supabase
      .channel(`bet-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets', filter: `id=eq.${id}` }, loadBet)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_votes', filter: `bet_id=eq.${id}` }, loadBet)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_participants', filter: `bet_id=eq.${id}` }, loadBet)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_cancel_votes', filter: `bet_id=eq.${id}` }, loadBet)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, loadBet])

  // Auto-resolve when majority reached
  useEffect(() => {
    if (!bet || bet.status !== 'voting' || resolving.current) return
    const accepted = bet.participants?.filter((p: any) => p.accepted) ?? []
    if (accepted.length < 2) return
    const majority = Math.floor(accepted.length / 2) + 1

    if (bet.is_team_bet) {
      // Count votes for each team (voted_for_id = 'A' or 'B')
      const teamAVotes = bet.votes?.filter((v: any) => v.voted_for_id === 'A').length ?? 0
      const teamBVotes = bet.votes?.filter((v: any) => v.voted_for_id === 'B').length ?? 0
      const winningTeam = teamAVotes >= majority ? 'A' : teamBVotes >= majority ? 'B' : null
      if (winningTeam) {
        resolving.current = true
        fetch('/api/bets/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bet_id: id, winning_team: winningTeam }),
        }).finally(() => { resolving.current = false })
      }
    } else {
      const tally: Record<string, number> = {}
      bet.votes?.forEach((v: any) => { tally[v.voted_for_id] = (tally[v.voted_for_id] ?? 0) + 1 })
      const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
      if (top && Number(top[1]) >= majority) {
        resolving.current = true
        fetch('/api/bets/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bet_id: id, winner_id: top[0] }),
        }).finally(() => { resolving.current = false })
      }
    }
  }, [bet?.votes?.length, bet?.status, id])

  // Auto-cancel when cancel majority reached
  useEffect(() => {
    if (!bet || bet.status === 'resolved' || bet.status === 'cancelled' || cancelling.current) return
    const accepted = bet.participants?.filter((p: any) => p.accepted) ?? []
    const majority = Math.floor(accepted.length / 2) + 1
    if (cancelVotes.length >= majority && accepted.length >= 2) {
      cancelling.current = true
      fetch('/api/bets/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet_id: id, force: false }),
      }).finally(() => { cancelling.current = false })
    }
  }, [cancelVotes.length, bet?.status, id])

  async function handleAccept() {
    setActionLoading(true)
    setError('')
    if (profile && bet) {
      const newBalance = Math.max(0, profile.balance - bet.amount)
      await supabase.from('profiles').update({ balance: newBalance }).eq('id', currentUser.id)
      await supabase.from('transactions').insert({
        user_id: currentUser.id, amount: -bet.amount, type: 'bet_pending',
        description: `Gajure en attente: ${bet.title}`, reference_id: id,
      })
    }
    const updateData: any = { accepted: true, prediction: prediction.trim() || null }
    if (bet?.is_team_bet) updateData.team = myAcceptTeam
    await supabase.from('bet_participants').update(updateData).eq('bet_id', id).eq('user_id', currentUser.id)
    setSuccess('Gajure acceptée!')
    setTimeout(() => setSuccess(''), 3000)
    setActionLoading(false)
  }

  async function handleStartVoting() {
    setActionLoading(true)
    await supabase.from('bets').update({ status: 'voting' }).eq('id', id)
    setActionLoading(false)
  }

  async function handleVote() {
    if (!votingFor) return
    setActionLoading(true)
    setError('')
    const { error: vErr } = await supabase.from('bet_votes').insert({
      bet_id: id, voter_id: currentUser.id, voted_for_id: votingFor,
    })
    if (vErr) setError('Erreur lors du vote.')
    setActionLoading(false)
  }

  async function handleAdminResolve(winnerId: string, label: string) {
    if (!confirm(`Désigner "${label}" comme gagnant?`)) return
    setActionLoading(true)
    setError('')
    const body = bet?.is_team_bet
      ? { bet_id: id, winning_team: winnerId }
      : { bet_id: id, winner_id: winnerId }
    const res = await fetch('/api/bets/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur') }
    setActionLoading(false)
  }

  async function handleVoteCancel() {
    setActionLoading(true)
    setError('')
    const res = await fetch('/api/bets/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet_id: id, force: false }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? 'Erreur')
    else if (data.refunded) setSuccess('Gajure annulée — remboursement effectué!')
    else setSuccess(`Vote d'annulation: ${data.votes}/${data.majority}`)
    setTimeout(() => setSuccess(''), 4000)
    setActionLoading(false)
  }

  async function handleAdminCancel() {
    if (!confirm('Annuler et rembourser tous les joueurs?')) return
    setActionLoading(true)
    const res = await fetch('/api/bets/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet_id: id, force: true }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur') }
    setActionLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="w-8 h-8 border-2 border-gold-400/20 border-t-gold-400 rounded-full animate-spin" />
    </div>
  )
  if (!bet) return (
    <div className="text-center py-16">
      <div className="text-3xl mb-3">🔍</div>
      <div className="text-cral-sub text-sm">Gajure introuvable.</div>
      <Link href="/gajures" className="btn-outline mt-4 inline-block text-sm">← Retour</Link>
    </div>
  )

  const isTeamBet = !!bet.is_team_bet
  const isCreator = bet.creator_id === currentUser?.id
  const isSuperAdmin = profile?.role === 'super_admin'
  const acceptedParticipants = bet.participants?.filter((p: any) => p.accepted) ?? []
  const pendingParticipants = bet.participants?.filter((p: any) => !p.accepted) ?? []
  const myParticipation = bet.participants?.find((p: any) => p.user_id === currentUser?.id)
  const myVote = bet.votes?.find((v: any) => v.voter_id === currentUser?.id)
  const myCancelVote = cancelVotes.find((v: any) => v.voter_id === currentUser?.id)
  const totalPool = bet.amount * acceptedParticipants.length
  const majority = Math.floor(acceptedParticipants.length / 2) + 1
  const isActive = bet.status !== 'resolved' && bet.status !== 'cancelled'

  // Team stats
  const teamA = acceptedParticipants.filter((p: any) => p.team === 'A')
  const teamB = acceptedParticipants.filter((p: any) => p.team === 'B')
  const teamAVotes = bet.votes?.filter((v: any) => v.voted_for_id === 'A').length ?? 0
  const teamBVotes = bet.votes?.filter((v: any) => v.voted_for_id === 'B').length ?? 0

  // Solo tally
  const tally: Record<string, number> = {}
  if (!isTeamBet) bet.votes?.forEach((v: any) => { tally[v.voted_for_id] = (tally[v.voted_for_id] ?? 0) + 1 })

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/gajures" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-cral-card transition-colors text-cral-sub flex-shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-bold text-cral-text truncate">{bet.title}</h1>
            {isTeamBet && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 font-medium flex items-center gap-1 flex-shrink-0">
                <Users size={10} /> Équipes
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getStatusColor(bet.status))}>
              {getStatusLabel(bet.status)}
            </span>
            <span className="text-xs text-cral-sub">par {bet.creator?.username}</span>
            <span className="text-xs text-cral-muted">{formatDate(bet.created_at)}</span>
          </div>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-3">✓ {success}</div>}

      {/* Winner/result banners */}
      {bet.status === 'resolved' && (
        <div className="rounded-xl p-6 text-center glow-gold" style={{
          background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))',
          border: '1px solid rgba(251,191,36,0.4)'
        }}>
          <Trophy size={36} className="text-gold-400 mx-auto mb-3" />
          {isTeamBet ? (
            <>
              <div className="text-2xl font-display font-bold text-cral-text">
                {bet.winner_team === 'A' ? '🔵 Équipe A' : '🔴 Équipe B'} remporte la gajure!
              </div>
              <div className="text-cral-sub text-sm mt-1">
                {(bet.winner_team === 'A' ? teamA : teamB).map((p: any) => p.profile?.username).join(', ')}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-display font-bold text-cral-text">{bet.winner?.username}</div>
              <div className="text-cral-sub text-sm mt-1">a remporté la gajure!</div>
            </>
          )}
          <div className="font-mono text-3xl font-bold text-gold-400 mt-2">+₡{formatCral(totalPool)}</div>
          {isTeamBet && (
            <div className="text-xs text-cral-sub mt-1">
              divisé entre {(bet.winner_team === 'A' ? teamA : teamB).length} gagnants
            </div>
          )}
        </div>
      )}

      {bet.status === 'cancelled' && (
        <div className="card text-center py-6 border-red-400/20">
          <RotateCcw size={28} className="text-red-400 mx-auto mb-2" />
          <div className="text-sm font-medium text-red-400">Gajure annulée — mises remboursées</div>
        </div>
      )}

      {/* Stats */}
      <div className="card">
        {bet.description && <p className="text-cral-sub text-sm leading-relaxed mb-4 pb-4 border-b border-cral-border">{bet.description}</p>}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="font-mono text-xl font-bold text-gold-400">₡{formatCral(bet.amount)}</div>
            <div className="text-xs text-cral-sub mt-1">Mise / joueur</div>
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-gold-400">₡{formatCral(totalPool)}</div>
            <div className="text-xs text-cral-sub mt-1">Cagnotte totale</div>
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-cral-text">{acceptedParticipants.length}</div>
            <div className="text-xs text-cral-sub mt-1">Joueurs actifs</div>
          </div>
        </div>
      </div>

      {/* Team display */}
      {isTeamBet && acceptedParticipants.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {(['A', 'B'] as const).map(team => {
            const members = acceptedParticipants.filter((p: any) => p.team === team)
            const sharePerWinner = members.length > 0 ? totalPool / members.length : 0
            const voteCount = team === 'A' ? teamAVotes : teamBVotes
            const pct = acceptedParticipants.length > 0 ? (voteCount / acceptedParticipants.length) * 100 : 0
            return (
              <div key={team} className={`rounded-xl p-4 border ${
                team === 'A' ? 'bg-blue-400/5 border-blue-400/20' : 'bg-red-400/5 border-red-400/20'
              }`}>
                <div className={`text-sm font-bold mb-2 ${team === 'A' ? 'text-blue-300' : 'text-red-300'}`}>
                  {team === 'A' ? '🔵' : '🔴'} Équipe {team} ({members.length})
                </div>
                <div className="space-y-1.5 mb-3">
                  {members.map((p: any) => (
                    <div key={p.user_id} className="flex items-center gap-2">
                      <Avatar username={p.profile?.username ?? '?'} avatarColor={p.profile?.avatar_color ?? '#888'} avatarSvg={p.profile?.avatar_svg} size={20} />
                      <span className="text-xs text-cral-text">{p.profile?.username}</span>
                      {p.prediction && <span className="text-xs text-cral-muted italic truncate">"{p.prediction}"</span>}
                    </div>
                  ))}
                  {members.length === 0 && <div className="text-xs text-cral-muted italic">Aucun joueur</div>}
                </div>
                {members.length > 0 && (
                  <div className="text-xs text-cral-muted">
                    Si vainqueur: <span className={`font-mono font-medium ${team === 'A' ? 'text-blue-300' : 'text-red-300'}`}>
                      ₡{formatCral(sharePerWinner)} / joueur
                    </span>
                  </div>
                )}
                {bet.status === 'voting' && voteCount > 0 && (
                  <div className="mt-2">
                    <div className={`h-1.5 rounded-full overflow-hidden ${team === 'A' ? 'bg-blue-900/50' : 'bg-red-900/50'}`}>
                      <div className={`h-full rounded-full transition-all duration-700 ${team === 'A' ? 'bg-blue-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-cral-muted mt-0.5">{voteCount} vote{voteCount !== 1 ? 's' : ''}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Solo participants */}
      {!isTeamBet && (
        <div className="card">
          <div className="text-sm font-medium text-cral-text mb-4 flex items-center gap-2">
            Participants
            {pendingParticipants.length > 0 && (
              <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                {pendingParticipants.length} en attente
              </span>
            )}
          </div>
          <div className="space-y-3">
            {bet.participants?.map((p: any) => {
              const votes = tally[p.user_id] ?? 0
              const pct = acceptedParticipants.length > 0 ? (votes / acceptedParticipants.length) * 100 : 0
              return (
                <div key={p.id} className={cn('flex items-center gap-3 p-2 rounded-xl', bet.winner_id === p.user_id && 'bg-gold-400/10')}>
                  <Avatar username={p.profile?.username ?? '?'} avatarColor={p.profile?.avatar_color ?? '#888'} avatarSvg={p.profile?.avatar_svg} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-cral-text">{p.profile?.username}</span>
                      {p.user_id === bet.creator_id && <span className="text-xs text-gold-500/70">créateur</span>}
                      {p.user_id === currentUser?.id && <span className="text-xs text-cral-muted">vous</span>}
                      {bet.winner_id === p.user_id && <Trophy size={13} className="text-gold-400" />}
                    </div>
                    {p.accepted && p.prediction && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <MessageSquare size={10} className="text-blue-400 flex-shrink-0" />
                        <span className="text-xs text-blue-300 italic">"{p.prediction}"</span>
                      </div>
                    )}
                    {bet.status === 'voting' && acceptedParticipants.some((ap: any) => ap.user_id === p.user_id) && (
                      <div className="mt-1.5">
                        <div className="h-1.5 rounded-full bg-cral-border overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: votes >= majority ? '#fbbf24' : '#60a5fa' }} />
                        </div>
                        <div className="text-xs text-cral-sub mt-0.5">{votes} vote{votes !== 1 ? 's' : ''}{votes >= majority && ' · ✓'}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {p.accepted ? <CheckCircle size={16} className="text-green-400" /> : <Clock size={16} className="text-yellow-400/60" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Accept invitation */}
      {myParticipation && !myParticipation.accepted && isActive && (
        <div className="rounded-xl p-5 space-y-4" style={{
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)'
        }}>
          <div className="text-sm font-medium text-cral-text">
            🎲 Invitation pour <span className="text-gold-400 font-mono font-medium">₡{formatCral(bet.amount)}</span>
          </div>

          {isTeamBet && (
            <div>
              <label className="block text-xs font-medium text-cral-sub mb-2">Votre équipe</label>
              <div className="grid grid-cols-2 gap-2">
                {(['A', 'B'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setMyAcceptTeam(t)}
                    className={`py-2 rounded-xl font-bold text-sm transition-all border ${
                      myAcceptTeam === t
                        ? t === 'A' ? 'bg-blue-400/20 border-blue-400/50 text-blue-300' : 'bg-red-400/20 border-red-400/50 text-red-300'
                        : 'border-cral-border text-cral-sub hover:border-cral-muted'
                    }`}>
                    {t === 'A' ? '🔵' : '🔴'} Équipe {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-cral-sub mb-2 flex items-center gap-1.5">
              <MessageSquare size={12} /> Prédiction <span className="text-cral-muted">(optionnel)</span>
            </label>
            <input type="text" value={prediction} onChange={e => setPrediction(e.target.value)}
              className="input-field text-sm" placeholder="ex: Pierre arrivera premier..." maxLength={120} />
          </div>

          <button onClick={handleAccept} disabled={actionLoading}
            className="btn-gold w-full py-2.5 flex items-center justify-center gap-2">
            {actionLoading ? <span className="w-4 h-4 border-2 border-cral-bg/30 border-t-cral-bg rounded-full animate-spin" /> : <CheckCircle size={16} />}
            Accepter la gajure
          </button>
        </div>
      )}

      {/* Start voting */}
      {(isCreator || isSuperAdmin) && bet.status === 'active' && acceptedParticipants.length >= 2 && (
        <button onClick={handleStartVoting} disabled={actionLoading}
          className="w-full flex items-center justify-center gap-2 border border-blue-400/30 bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 px-6 py-3 rounded-xl transition-all text-sm font-medium">
          {actionLoading ? <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /> : <Vote size={16} />}
          La partie est terminée — Démarrer le vote
        </button>
      )}

      {/* Vote */}
      {bet.status === 'voting' && myParticipation?.accepted && !myVote && (
        <div className="card space-y-4" style={{ borderColor: 'rgba(96,165,250,0.3)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-cral-text flex items-center gap-2">
              <Vote size={16} className="text-blue-400" />
              {isTeamBet ? 'Quelle équipe a gagné?' : 'Qui a gagné?'}
            </div>
            <div className="text-xs text-cral-sub">{bet.votes?.length ?? 0}/{acceptedParticipants.length} · Majorité: {majority}</div>
          </div>

          {isTeamBet ? (
            <div className="grid grid-cols-2 gap-3">
              {(['A', 'B'] as const).map(team => {
                const members = acceptedParticipants.filter((p: any) => p.team === team)
                return (
                  <button key={team} type="button" onClick={() => setVotingFor(team)}
                    className={cn(
                      'flex flex-col items-center gap-2 px-4 py-4 rounded-xl transition-all border',
                      votingFor === team
                        ? team === 'A' ? 'border-blue-400/50 bg-blue-400/15' : 'border-red-400/50 bg-red-400/15'
                        : 'border-cral-border hover:border-cral-muted hover:bg-cral-surface'
                    )}>
                    <span className="text-2xl">{team === 'A' ? '🔵' : '🔴'}</span>
                    <span className={`font-bold text-sm ${team === 'A' ? 'text-blue-300' : 'text-red-300'}`}>Équipe {team}</span>
                    <span className="text-xs text-cral-muted">{members.map((p: any) => p.profile?.username).join(', ')}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {acceptedParticipants.map((p: any) => (
                <button key={p.user_id} type="button" onClick={() => setVotingFor(p.user_id)}
                  className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border text-left',
                    votingFor === p.user_id ? 'border-gold-400/50 bg-gold-400/10' : 'border-cral-border hover:border-cral-muted hover:bg-cral-surface'
                  )}>
                  <Avatar username={p.profile?.username ?? '?'} avatarColor={p.profile?.avatar_color ?? '#888'} avatarSvg={p.profile?.avatar_svg} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-cral-text">{p.profile?.username}</div>
                    {p.prediction && <div className="text-xs text-blue-300 italic mt-0.5">"{p.prediction}"</div>}
                  </div>
                  {votingFor === p.user_id && (
                    <div className="w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="#0a0a0f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          <button onClick={handleVote} disabled={!votingFor || actionLoading}
            className="btn-gold w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {actionLoading ? <span className="w-4 h-4 border-2 border-cral-bg/30 border-t-cral-bg rounded-full animate-spin" /> : <CheckCircle size={16} />}
            Confirmer mon vote
          </button>
        </div>
      )}

      {/* Already voted */}
      {bet.status === 'voting' && myVote && (
        <div className="card text-center py-5" style={{ borderColor: 'rgba(52,211,153,0.2)' }}>
          <CheckCircle size={22} className="text-green-400 mx-auto mb-2" />
          <div className="text-sm text-cral-text">
            {isTeamBet
              ? <>Vote pour <span className="font-bold">{myVote.voted_for_id === 'A' ? '🔵 Équipe A' : '🔴 Équipe B'}</span></>
              : <>Vote pour <span className="text-gold-400 font-medium">{myVote.voted_for?.username}</span></>
            }
          </div>
          <div className="text-xs text-cral-sub mt-1">{bet.votes?.length ?? 0}/{acceptedParticipants.length} · Majorité à {majority}</div>
        </div>
      )}

      {/* Cancel vote */}
      {isActive && myParticipation?.accepted && !myCancelVote && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-red-400 flex items-center gap-2"><XCircle size={13} />Demander l&apos;annulation</div>
            <div className="text-xs text-cral-muted">{cancelVotes.length}/{majority} votes requis</div>
          </div>
          {cancelVotes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {cancelVotes.map((v: any) => (
                <span key={v.id} className="text-xs bg-red-400/10 text-red-400 px-2 py-0.5 rounded-full">{v.voter?.username}</span>
              ))}
            </div>
          )}
          <button onClick={handleVoteCancel} disabled={actionLoading}
            className="w-full py-2 rounded-lg text-xs font-medium text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors flex items-center justify-center gap-2">
            {actionLoading ? <span className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <RotateCcw size={13} />}
            Voter pour l&apos;annulation (remboursement)
          </button>
        </div>
      )}

      {/* Super admin panel */}
      {isSuperAdmin && isActive && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div className="text-xs text-purple-400 flex items-center gap-2 font-semibold uppercase tracking-wider">
            <Shield size={12} /> Contrôle Super Admin
          </div>
          {isTeamBet ? (
            <div className="flex gap-2">
              {(['A', 'B'] as const).filter(t => acceptedParticipants.some((p: any) => p.team === t)).map(team => (
                <button key={team} onClick={() => handleAdminResolve(team, `Équipe ${team}`)} disabled={actionLoading}
                  className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                    team === 'A' ? 'border-blue-400/30 text-blue-300 hover:bg-blue-400/10' : 'border-red-400/30 text-red-300 hover:bg-red-400/10'
                  }`}>
                  <Trophy size={12} /> {team === 'A' ? '🔵' : '🔴'} Équipe {team} gagne
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {acceptedParticipants.map((p: any) => (
                <button key={p.user_id} onClick={() => handleAdminResolve(p.user_id, p.profile?.username)} disabled={actionLoading}
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-purple-400/30 text-purple-300 hover:bg-purple-400/10 transition-colors disabled:opacity-50">
                  <Trophy size={12} /> {p.profile?.username}
                </button>
              ))}
            </div>
          )}
          <div className="pt-2 border-t border-cral-border">
            <button onClick={handleAdminCancel} disabled={actionLoading}
              className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-2">
              <RotateCcw size={12} /> Annuler et rembourser tous
            </button>
          </div>
        </div>
      )}

      {/* Votes log */}
      {(bet.votes?.length ?? 0) > 0 && (
        <div className="card">
          <div className="text-sm font-medium text-cral-text mb-3">Journal des votes</div>
          <div className="space-y-1.5">
            {bet.votes.map((v: any) => (
              <div key={v.id} className="flex items-center gap-2 text-xs py-1 text-cral-sub">
                <span className="text-cral-text">{v.voter?.username}</span>
                <span className="text-cral-muted">→</span>
                <span className={isTeamBet ? (v.voted_for_id === 'A' ? 'text-blue-400 font-medium' : 'text-red-400 font-medium') : 'text-gold-400 font-medium'}>
                  {isTeamBet ? (v.voted_for_id === 'A' ? '🔵 Équipe A' : '🔴 Équipe B') : v.voted_for?.username}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
