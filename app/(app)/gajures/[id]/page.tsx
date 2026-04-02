'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { formatCral, formatDate, getStatusLabel, getStatusColor, getInitials, cn } from '@/lib/utils'
import { ArrowLeft, Trophy, Vote, CheckCircle, Shield, Clock } from 'lucide-react'
import Link from 'next/link'

export default function GajureDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [bet, setBet] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [votingFor, setVotingFor] = useState<string>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()
  const resolving = useRef(false)

  const loadBet = useCallback(async () => {
    const { data } = await supabase
      .from('bets')
      .select(`
        *,
        creator:profiles!bets_creator_id_fkey(id, username, avatar_color),
        winner:profiles!bets_winner_id_fkey(id, username, avatar_color),
        participants:bet_participants(id, user_id, accepted, profile:profiles(id, username, avatar_color)),
        votes:bet_votes(id, voter_id, voted_for_id,
          voter:profiles!bet_votes_voter_id_fkey(id, username),
          voted_for:profiles!bet_votes_voted_for_id_fkey(id, username)
        )
      `)
      .eq('id', id)
      .single()
    if (data) setBet(data)
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
      .channel(`bet-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets', filter: `id=eq.${id}` }, loadBet)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_votes', filter: `bet_id=eq.${id}` }, loadBet)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_participants', filter: `bet_id=eq.${id}` }, loadBet)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, loadBet])

  // Auto-resolve when majority reached — server-validated
  useEffect(() => {
    if (!bet || bet.status !== 'voting' || resolving.current) return
    const accepted = bet.participants?.filter((p: any) => p.accepted) ?? []
    if (accepted.length < 2) return
    const majority = Math.floor(accepted.length / 2) + 1
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
  }, [bet?.votes?.length, bet?.status, id])

  async function handleAccept() {
    setActionLoading(true)
    setError('')
    await supabase.from('bet_participants')
      .update({ accepted: true })
      .eq('bet_id', id)
      .eq('user_id', currentUser.id)
    setSuccess('Vous avez accepté la gajure!')
    setTimeout(() => setSuccess(''), 3000)
    setActionLoading(false)
  }

  async function handleStartVoting() {
    setActionLoading(true)
    setError('')
    await supabase.from('bets').update({ status: 'voting' }).eq('id', id)
    setActionLoading(false)
  }

  async function handleVote() {
    if (!votingFor) return
    setActionLoading(true)
    setError('')
    const { error: vErr } = await supabase.from('bet_votes').insert({
      bet_id: id,
      voter_id: currentUser.id,
      voted_for_id: votingFor,
    })
    if (vErr) setError('Erreur lors du vote.')
    setActionLoading(false)
  }

  async function handleAdminResolve(winnerId: string, winnerName: string) {
    if (!confirm(`Désigner ${winnerName} comme gagnant?`)) return
    setActionLoading(true)
    setError('')
    const res = await fetch('/api/bets/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet_id: id, winner_id: winnerId }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erreur serveur')
    }
    setActionLoading(false)
  }

  async function handleCancel() {
    if (!confirm('Annuler cette gajure? Cette action est irréversible.')) return
    setActionLoading(true)
    setError('')
    const res = await fetch('/api/bets/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bet_id: id }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erreur')
    }
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

  const isCreator = bet.creator_id === currentUser?.id
  const isSuperAdmin = profile?.role === 'super_admin'
  const acceptedParticipants = bet.participants?.filter((p: any) => p.accepted) ?? []
  const pendingParticipants = bet.participants?.filter((p: any) => !p.accepted) ?? []
  const myParticipation = bet.participants?.find((p: any) => p.user_id === currentUser?.id)
  const myVote = bet.votes?.find((v: any) => v.voter_id === currentUser?.id)
  const totalPool = bet.amount * acceptedParticipants.length
  const votesTotal = bet.votes?.length ?? 0
  const majority = Math.floor(acceptedParticipants.length / 2) + 1

  const tally: Record<string, number> = {}
  bet.votes?.forEach((v: any) => { tally[v.voted_for_id] = (tally[v.voted_for_id] ?? 0) + 1 })

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/gajures"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-cral-card transition-colors text-cral-sub flex-shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold text-cral-text truncate">{bet.title}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getStatusColor(bet.status))}>
              {getStatusLabel(bet.status)}
            </span>
            <span className="text-xs text-cral-sub">par {bet.creator?.username}</span>
            <span className="text-xs text-cral-muted">{formatDate(bet.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-3">✓ {success}</div>
      )}

      {/* Winner banner */}
      {bet.status === 'resolved' && bet.winner && (
        <div className="rounded-xl p-6 text-center glow-gold" style={{
          background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.05) 100%)',
          border: '1px solid rgba(251,191,36,0.4)'
        }}>
          <Trophy size={36} className="text-gold-400 mx-auto mb-3" />
          <div className="text-2xl font-display font-bold text-cral-text">{bet.winner.username}</div>
          <div className="text-cral-sub text-sm mt-1">a remporté la gajure!</div>
          <div className="font-mono text-3xl font-bold text-gold-400 mt-2">+₡{formatCral(totalPool)}</div>
          {bet.resolved_at && <div className="text-xs text-cral-muted mt-2">{formatDate(bet.resolved_at)}</div>}
        </div>
      )}

      {/* Cancelled */}
      {bet.status === 'cancelled' && (
        <div className="card text-center py-6 border-red-400/20">
          <div className="text-2xl mb-2">❌</div>
          <div className="text-sm text-red-400">Cette gajure a été annulée.</div>
        </div>
      )}

      {/* Stats */}
      <div className="card">
        {bet.description && (
          <p className="text-cral-sub text-sm leading-relaxed mb-4 pb-4 border-b border-cral-border">{bet.description}</p>
        )}
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

      {/* Invitation */}
      {myParticipation && !myParticipation.accepted && bet.status !== 'resolved' && bet.status !== 'cancelled' && (
        <div className="rounded-xl p-5 space-y-3" style={{
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)'
        }}>
          <div className="text-sm font-medium text-cral-text">
            🎲 Vous êtes invité pour{' '}
            <span className="text-gold-400 font-mono font-medium">₡{formatCral(bet.amount)}</span>
          </div>
          <button onClick={handleAccept} disabled={actionLoading}
            className="btn-gold w-full py-2.5 flex items-center justify-center gap-2">
            {actionLoading
              ? <span className="w-4 h-4 border-2 border-cral-bg/30 border-t-cral-bg rounded-full animate-spin" />
              : <CheckCircle size={16} />}
            Accepter la gajure
          </button>
        </div>
      )}

      {/* Participants list */}
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
            const isWinner = bet.winner_id === p.user_id
            return (
              <div key={p.id} className={cn('flex items-center gap-3 p-2 rounded-xl transition-all', isWinner && 'bg-gold-400/10')}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-cral-bg flex-shrink-0"
                  style={{ backgroundColor: p.profile?.avatar_color }}>
                  {getInitials(p.profile?.username ?? '?')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-cral-text">{p.profile?.username}</span>
                    {p.user_id === bet.creator_id && <span className="text-xs text-gold-500/70">créateur</span>}
                    {p.user_id === currentUser?.id && <span className="text-xs text-cral-muted">vous</span>}
                    {isWinner && <Trophy size={13} className="text-gold-400" />}
                  </div>
                  {bet.status === 'voting' && acceptedParticipants.some((ap: any) => ap.user_id === p.user_id) && (
                    <div className="mt-1.5">
                      <div className="h-1.5 rounded-full bg-cral-border overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: votes >= majority ? '#fbbf24' : '#60a5fa' }} />
                      </div>
                      <div className="text-xs text-cral-sub mt-0.5">
                        {votes} vote{votes !== 1 ? 's' : ''}
                        {votes >= majority && ' · ✓ Majorité'}
                      </div>
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

      {/* Start voting button */}
      {(isCreator || isSuperAdmin) && bet.status === 'active' && acceptedParticipants.length >= 2 && (
        <button onClick={handleStartVoting} disabled={actionLoading}
          className="w-full flex items-center justify-center gap-2 border border-blue-400/30 bg-blue-400/10 text-blue-400 hover:bg-blue-400/20 px-6 py-3 rounded-xl transition-all text-sm font-medium">
          {actionLoading
            ? <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            : <Vote size={16} />}
          La partie est terminée — Démarrer le vote
        </button>
      )}

      {/* Vote form */}
      {bet.status === 'voting' && myParticipation?.accepted && !myVote && (
        <div className="card space-y-4" style={{ borderColor: 'rgba(96,165,250,0.3)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-cral-text flex items-center gap-2">
              <Vote size={16} className="text-blue-400" />
              Qui a gagné la partie?
            </div>
            <div className="text-xs text-cral-sub">{votesTotal}/{acceptedParticipants.length} · Majorité: {majority}</div>
          </div>
          <div className="space-y-2">
            {acceptedParticipants.map((p: any) => (
              <button key={p.user_id} type="button" onClick={() => setVotingFor(p.user_id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border text-left',
                  votingFor === p.user_id
                    ? 'border-gold-400/50 bg-gold-400/10'
                    : 'border-cral-border hover:border-cral-muted hover:bg-cral-surface'
                )}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-cral-bg flex-shrink-0"
                  style={{ backgroundColor: p.profile?.avatar_color }}>
                  {getInitials(p.profile?.username ?? '?')}
                </div>
                <span className="text-sm text-cral-text flex-1">{p.profile?.username}</span>
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
          <button onClick={handleVote} disabled={!votingFor || actionLoading}
            className="btn-gold w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {actionLoading
              ? <span className="w-4 h-4 border-2 border-cral-bg/30 border-t-cral-bg rounded-full animate-spin" />
              : <CheckCircle size={16} />}
            Confirmer mon vote
          </button>
        </div>
      )}

      {/* Already voted */}
      {bet.status === 'voting' && myVote && (
        <div className="card text-center py-5" style={{ borderColor: 'rgba(52,211,153,0.2)' }}>
          <CheckCircle size={22} className="text-green-400 mx-auto mb-2" />
          <div className="text-sm text-cral-text">
            Votre vote: <span className="text-gold-400 font-medium">{myVote.voted_for?.username}</span>
          </div>
          <div className="text-xs text-cral-sub mt-1">
            {votesTotal} vote{votesTotal !== 1 ? 's' : ''} · Majorité à {majority}
          </div>
        </div>
      )}

      {/* Super admin controls */}
      {isSuperAdmin && bet.status !== 'resolved' && bet.status !== 'cancelled' && (
        <div className="rounded-xl p-5 space-y-4" style={{
          background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)'
        }}>
          <div className="text-xs text-purple-400 flex items-center gap-2 font-semibold uppercase tracking-wider">
            <Shield size={12} /> Contrôle Super Admin
          </div>
          {acceptedParticipants.length > 0 ? (
            <>
              <div className="text-xs text-cral-sub">Désigner le gagnant directement:</div>
              <div className="flex flex-wrap gap-2">
                {acceptedParticipants.map((p: any) => (
                  <button key={p.user_id}
                    onClick={() => handleAdminResolve(p.user_id, p.profile?.username)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-purple-400/30 text-purple-300 hover:bg-purple-400/10 transition-colors disabled:opacity-50">
                    <Trophy size={12} /> {p.profile?.username}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-cral-muted">Aucun joueur actif.</div>
          )}
          <div className="pt-2 border-t border-cral-border">
            <button onClick={handleCancel} disabled={actionLoading}
              className="text-xs text-red-400 hover:text-red-300 transition-colors">
              Annuler cette gajure
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
                <span className="text-gold-400 font-medium">{v.voted_for?.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
