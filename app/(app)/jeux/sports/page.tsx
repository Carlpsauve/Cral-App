'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { SPORTS, getSportInfo, formatOdds, formatAmericanOdds, potentialWin, betStatusColor, betStatusLabel } from '@/lib/sports'
import { formatCral, formatDate } from '@/lib/utils'
import { ArrowLeft, RefreshCw, Clock } from 'lucide-react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'

interface Match {
  id: string
  sport_key: string
  sport_label: string
  home_team: string
  away_team: string
  commence_time: string
  status: string
  odds_home: number
  odds_away: number
  odds_draw: number | null
  odds_updated: string
  home_score: number | null
  away_score: number | null
  winner: string | null
}

interface SportBet {
  id: string
  match_id: string
  pick: string
  amount: number
  odds: number
  potential_win: number
  status: string
  created_at: string
  sport_matches: Match
}

type Tab = 'matchs' | 'mes-paris'

const SPORT_GROUPS = [
  { label: 'Amérique du Nord', keys: ['icehockey_nhl', 'americanfootball_nfl', 'soccer_usa_mls'] },
  { label: 'Europe', keys: ['soccer_epl', 'soccer_spain_la_liga', 'soccer_france_ligue_one', 'soccer_germany_bundesliga', 'soccer_italy_serie_a', 'soccer_uefa_champs_league', 'soccer_uefa_europa_league'] },
  { label: 'Monde', keys: ['soccer_fifa_world_cup'] },
]

export default function SportsPage() {
  const [tab, setTab] = useState<Tab>('matchs')
  const [matches, setMatches] = useState<Match[]>([])
  const [myBets, setMyBets] = useState<SportBet[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedSport, setSelectedSport] = useState<string>('all')
  const [betModal, setBetModal] = useState<{ match: Match; pick: 'home' | 'away' | 'draw' } | null>(null)
  const [betAmount, setBetAmount] = useState(10)
  const [placingBet, setPlacingBet] = useState(false)
  const [betError, setBetError] = useState('')
  const [betSuccess, setBetSuccess] = useState('')
  const [noKey, setNoKey] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const supabase = createClient()

  const loadData = useCallback(async (forceRefresh = false) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
    if (profile) setBalance(profile.balance)

    // Fetch matches
    const res = await fetch(`/api/sports/odds${forceRefresh ? '?refresh=1' : ''}`)
    const data = await res.json()
    setMatches(data.matches ?? [])
    setNoKey(!!data.no_key)
    setLastUpdate(data.last_update ?? null)

    // Fetch my bets
    const { data: bets } = await supabase
      .from('sport_bets')
      .select('*, sport_matches(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setMyBets(bets ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let channel: any = null

    async function init() {
      await loadData()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Build all .on() chains before calling .subscribe()
      channel = supabase
        .channel('sports-page')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload: any) => setBalance(payload.new.balance))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sport_bets', filter: `user_id=eq.${user.id}` },
          () => loadData())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sport_matches' },
          () => loadData())
        .subscribe()
    }

    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [loadData])

  async function handleRefresh() {
    setRefreshing(true)
    await loadData(true)
    setRefreshing(false)
  }

  async function handlePlaceBet() {
    if (!betModal) return
    setPlacingBet(true)
    setBetError('')
    const res = await fetch('/api/sports/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: betModal.match.id, pick: betModal.pick, amount: betAmount }),
    })
    const data = await res.json()
    if (!res.ok) {
      setBetError(data.error)
    } else {
      setBalance(data.new_balance)
      setBetSuccess(`Pari placé! Gain potentiel: ₡${formatCral(potentialWin(betAmount, betModal.match[`odds_${betModal.pick}` as keyof Match] as number))}`)
      setBetModal(null)
      await loadData()
      setTimeout(() => setBetSuccess(''), 5000)
      fetch('/api/bounties/progress', { method: 'POST', body: JSON.stringify({ type: 'sports' }) }).catch(e => console.error(e));
    }
    setPlacingBet(false)
  }

  const filteredMatches = selectedSport === 'all'
    ? matches
    : matches.filter(m => m.sport_key === selectedSport)

  // Get my bet for a match
  const myBetForMatch = (matchId: string) => myBets.find(b => b.match_id === matchId)

  const pendingBets = myBets.filter(b => b.status === 'pending')
  const resolvedBets = myBets.filter(b => b.status !== 'pending')
  const totalPotential = pendingBets.reduce((s, b) => s + b.potential_win, 0)

  const matchesBySport: Record<string, Match[]> = {}
  filteredMatches.forEach(m => {
    if (!matchesBySport[m.sport_label]) matchesBySport[m.sport_label] = []
    matchesBySport[m.sport_label].push(m)
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="w-8 h-8 border-2 border-gold-400/20 border-t-gold-400 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/jeux" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-cral-card transition-colors text-cral-sub">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-2">
            🏟️ Paris sportifs
          </h1>
          <p className="text-cral-sub text-sm mt-1">Moneyline · NHL Hockey</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-lg font-bold text-gold-400">₡{formatCral(balance)}</div>
            {lastUpdate && (
              <div className="text-xs text-cral-muted">
                MAJ {new Date(lastUpdate).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="w-9 h-9 rounded-lg flex items-center justify-center border border-cral-border hover:border-gold-500/40 transition-all text-cral-sub hover:text-cral-text disabled:opacity-40">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Success message */}
      {betSuccess && (
        <div className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-3">
          ✓ {betSuccess}
        </div>
      )}

      {/* No API key warning */}
      {noKey && (
        <div className="rounded-xl px-5 py-4 text-sm" style={{
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)'
        }}>
          <div className="font-medium text-gold-400 mb-1">⚙️ Clé API manquante</div>
          <div className="text-cral-sub text-xs">
            Ajoutez <code className="bg-cral-surface px-1 rounded text-gold-300">ODDS_API_KEY</code> dans vos variables d&apos;environnement Vercel.
            Inscrivez-vous gratuitement sur{' '}
            <a href="https://the-odds-api.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
              the-odds-api.com
            </a>{' '}
            · 500 requêtes/mois gratuites.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('matchs')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${tab === 'matchs' ? 'bg-gold-400/15 border-gold-400/40 text-gold-400' : 'border-cral-border text-cral-sub hover:border-cral-muted'}`}>
          🏟️ Matchs disponibles ({matches.length})
        </button>
        <button onClick={() => setTab('mes-paris')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${tab === 'mes-paris' ? 'bg-gold-400/15 border-gold-400/40 text-gold-400' : 'border-cral-border text-cral-sub hover:border-cral-muted'}`}>
          🎯 Mes paris ({myBets.length})
          {pendingBets.length > 0 && (
            <span className="ml-2 text-xs bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded-full">{pendingBets.length}</span>
          )}
        </button>
      </div>

      {/* MATCHS TAB */}
      {tab === 'matchs' && (
        <div className="space-y-4">
          {/* Sport filter */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSelectedSport('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedSport === 'all' ? 'bg-cral-card border-cral-border text-cral-text' : 'border-transparent text-cral-muted hover:text-cral-sub'}`}>
              Tous
            </button>
            {SPORTS.map(sport => {
              const count = matches.filter(m => m.sport_key === sport.key).length
              if (count === 0) return null
              return (
                <button key={sport.key} onClick={() => setSelectedSport(sport.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedSport === sport.key ? 'bg-cral-card border-cral-border text-cral-text' : 'border-transparent text-cral-muted hover:text-cral-sub'}`}>
                  {sport.flag} {sport.label} ({count})
                </button>
              )
            })}
          </div>

          {filteredMatches.length === 0 ? (
            <div className="card text-center py-16">
              <div className="text-4xl mb-3">🏟️</div>
              <div className="text-cral-sub text-sm mb-4">
                {noKey ? 'Ajoutez votre clé API pour voir les matchs en direct' : 'Aucun match disponible pour le moment'}
              </div>
              {!noKey && (
                <button onClick={handleRefresh} disabled={refreshing} className="btn-gold text-sm py-2 px-6 flex items-center gap-2 mx-auto">
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualiser
                </button>
              )}
            </div>
          ) : (
            Object.entries(matchesBySport).map(([sportLabel, sportMatches]) => (
              <div key={sportLabel} className="space-y-2">
                <div className="text-xs font-semibold text-cral-sub uppercase tracking-wider px-1 flex items-center gap-2">
                  {getSportInfo(sportMatches[0].sport_key).flag} {sportLabel}
                </div>
                {sportMatches.map(match => {
                  const myBet = myBetForMatch(match.id)
                  const started = new Date(match.commence_time) < new Date()
                  return (
                    <MatchCard
                      key={match.id}
                      match={match}
                      myBet={myBet}
                      started={started}
                      balance={balance}
                      onBet={(pick) => {
                        setBetModal({ match, pick })
                        setBetAmount(Math.min(10, Math.floor(balance)))
                        setBetError('')
                      }}
                    />
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}

      {/* MES PARIS TAB */}
      {tab === 'mes-paris' && (
        <div className="space-y-4">
          {/* Summary */}
          {pendingBets.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="card text-center">
                <div className="font-mono text-lg font-bold text-yellow-400">{pendingBets.length}</div>
                <div className="text-xs text-cral-sub mt-1">En attente</div>
              </div>
              <div className="card text-center">
                <div className="font-mono text-lg font-bold text-cral-text">₡{formatCral(pendingBets.reduce((s, b) => s + b.amount, 0))}</div>
                <div className="text-xs text-cral-sub mt-1">Total misé</div>
              </div>
              <div className="card text-center">
                <div className="font-mono text-lg font-bold text-green-400">₡{formatCral(totalPotential)}</div>
                <div className="text-xs text-cral-sub mt-1">Gain potentiel</div>
              </div>
            </div>
          )}

          {myBets.length === 0 ? (
            <div className="card text-center py-16">
              <div className="text-4xl mb-3">🎯</div>
              <div className="text-cral-sub text-sm">Aucun pari placé pour l&apos;instant.</div>
              <button onClick={() => setTab('matchs')} className="btn-gold mt-4 text-sm py-2 px-6 mx-auto flex">
                Voir les matchs
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {myBets.map(bet => {
                const match = bet.sport_matches
                const sport = getSportInfo(match?.sport_key ?? '')
                const pickLabel = bet.pick === 'home' ? match?.home_team : bet.pick === 'away' ? match?.away_team : 'Nul'
                const netGain = bet.status === 'won' ? (bet.potential_win - bet.amount) : bet.status === 'lost' ? -bet.amount : null
                return (
                  <div key={bet.id} className="card space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs text-cral-muted">{sport.flag} {match?.sport_label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${betStatusColor(bet.status)}`}>
                            {betStatusLabel(bet.status)}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-cral-text">
                          {match?.home_team} vs {match?.away_team}
                        </div>
                        <div className="text-xs text-cral-sub mt-0.5">
                          Votre choix: <span className="text-cral-text font-medium">{pickLabel}</span>
                          {' '} · Cote ×{formatOdds(bet.odds)} ({formatAmericanOdds(bet.odds)})
                        </div>
                        <div className="text-xs text-cral-muted">{formatDate(bet.created_at)}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-mono text-sm font-bold text-cral-text">₡{formatCral(bet.amount)}</div>
                        {bet.status === 'pending' && (
                          <div className="text-xs text-green-400 font-mono">→ ₡{formatCral(bet.potential_win)}</div>
                        )}
                        {netGain !== null && (
                          <div className={`text-sm font-mono font-bold ${netGain > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {netGain > 0 ? '+' : ''}₡{formatCral(netGain)}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Score if finished */}
                    {match?.status === 'finished' && match.home_score != null && (
                      <div className="text-xs text-cral-sub text-center py-1.5 bg-cral-surface rounded-lg">
                        Résultat final: {match.home_team} <span className="font-mono font-bold text-cral-text mx-1">{match.home_score} – {match.away_score}</span> {match.away_team}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Bet Modal */}
      {betModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setBetModal(null) }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5" style={{ background: '#1a1a26', border: '1px solid #2a2a40' }}>
            <div>
              <div className="text-xs text-cral-muted mb-1">
                {getSportInfo(betModal.match.sport_key).flag} {betModal.match.sport_label}
              </div>
              <div className="font-display text-lg font-bold text-cral-text">
                {betModal.match.home_team} vs {betModal.match.away_team}
              </div>
              <div className="text-xs text-cral-sub mt-1">{formatDate(betModal.match.commence_time)}</div>
            </div>

            <div className="rounded-xl p-4 space-y-1" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <div className="text-xs text-cral-sub">Votre pari</div>
              <div className="font-medium text-cral-text">
                {betModal.pick === 'home' ? betModal.match.home_team : betModal.pick === 'away' ? betModal.match.away_team : 'Match nul'}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gold-400 font-mono font-bold">
                  ×{formatOdds(betModal.match[`odds_${betModal.pick}` as keyof Match] as number)}
                </span>
                <span className="text-cral-muted text-xs">
                  ({formatAmericanOdds(betModal.match[`odds_${betModal.pick}` as keyof Match] as number)})
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-cral-sub mb-2">
                Mise · Solde: ₡{formatCral(balance)}
              </label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[5, 10, 25, 50, 100].filter(v => v <= balance).map(v => (
                  <button key={v} onClick={() => setBetAmount(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${betAmount === v ? 'bg-gold-500 border-gold-400 text-cral-bg' : 'border-cral-border text-cral-sub hover:border-gold-500/40'}`}>
                    ₡{v}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={Math.min(1000, Math.floor(balance))} step={1}
                  value={betAmount} onChange={e => setBetAmount(parseInt(e.target.value))}
                  className="flex-1 accent-yellow-400" />
                <span className="font-mono font-bold text-gold-400 w-20 text-right">₡{formatCral(betAmount)}</span>
              </div>
              <div className="text-xs text-cral-sub mt-2 text-center">
                Gain potentiel: <span className="text-green-400 font-mono font-bold">
                  ₡{formatCral(potentialWin(betAmount, betModal.match[`odds_${betModal.pick}` as keyof Match] as number))}
                </span>
              </div>
            </div>

            {betError && (
              <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{betError}</div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setBetModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm border border-cral-border text-cral-sub hover:text-cral-text transition-all">
                Annuler
              </button>
              <button onClick={handlePlaceBet} disabled={placingBet || betAmount > balance}
                className="flex-1 btn-gold py-2.5 disabled:opacity-40 text-sm">
                {placingBet ? <span className="w-4 h-4 border-2 border-cral-bg/30 border-t-cral-bg rounded-full animate-spin inline-block" /> : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, myBet, started, balance, onBet }: {
  match: Match
  myBet: SportBet | undefined
  started: boolean
  balance: number
  onBet: (pick: 'home' | 'away' | 'draw') => void
}) {
  const [bets, setBets] = useState<any[]>([])
  const supabase = createClient()
  const hasDraw = match.odds_draw != null

  useEffect(() => {
    // Load bets immediately — no expand needed
    supabase
      .from('sport_bets')
      .select('pick, amount, status, profiles(username, avatar_color, avatar_svg)')
      .eq('match_id', match.id)
      .in('status', ['pending', 'won', 'lost'])
      .order('created_at', { ascending: true })
      .limit(30)
      .then(({ data }) => setBets(data ?? []))

    // Realtime updates when someone places a bet
    const channel = supabase
      .channel(`match-bets-${match.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'sport_bets',
        filter: `match_id=eq.${match.id}`
      }, () => {
        supabase
          .from('sport_bets')
          .select('pick, amount, status, profiles(username, avatar_color, avatar_svg)')
          .eq('match_id', match.id)
          .in('status', ['pending', 'won', 'lost'])
          .order('created_at', { ascending: true })
          .limit(30)
          .then(({ data }) => setBets(data ?? []))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [match.id])

  const commence = new Date(match.commence_time)
  const diffMs = commence.getTime() - Date.now()
  const diffH = Math.floor(diffMs / 3600000)
  const diffM = Math.floor((diffMs % 3600000) / 60000)
  const timeUntil = diffMs > 0
    ? diffH > 24 ? formatDate(match.commence_time)
    : diffH > 0 ? `Dans ${diffH}h${diffM}m`
    : `Dans ${diffM}m`
    : 'Commencé'

  // Group bets by pick
  const betsByPick: Record<string, any[]> = { home: [], away: [], draw: [] }
  bets.forEach(b => {
    if (betsByPick[b.pick]) betsByPick[b.pick].push(b)
  })

  const picks = ['home', 'away', ...(hasDraw ? ['draw'] : [])] as const

  return (
    <div className={`card space-y-4 transition-all ${myBet ? 'border-gold-400/25' : ''}`}>
      {/* Match header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs flex items-center gap-1 ${started ? 'text-red-400' : 'text-cral-muted'}`}>
              {started ? '🔴 En cours' : <><Clock size={10} /> {timeUntil}</>}
            </span>
          </div>
          <div className="text-sm font-medium text-cral-text">
            {match.home_team} <span className="text-cral-muted">vs</span> {match.away_team}
          </div>
          {myBet && (
            <div className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${betStatusColor(myBet.status)}`}>
              {betStatusLabel(myBet.status)} · {myBet.pick === 'home' ? match.home_team : myBet.pick === 'away' ? match.away_team : 'Nul'}
              {' '}· ₡{formatCral(myBet.amount)}
            </div>
          )}
        </div>
        {bets.length > 0 && (
          <div className="text-xs text-cral-muted flex-shrink-0">
            {bets.length} pari{bets.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Odds columns with avatars underneath */}
      <div className={`grid gap-3 ${hasDraw ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {picks.map(pick => {
          const odds = pick === 'home' ? match.odds_home : pick === 'away' ? match.odds_away : match.odds_draw
          if (!odds) return null
          const label = pick === 'home' ? match.home_team : pick === 'away' ? match.away_team : 'Nul'
          const isMyPick = myBet?.pick === pick
          const canBet = !myBet && !started && balance >= 1
          const pickBets = betsByPick[pick] ?? []

          return (
            <div key={pick} className="flex flex-col gap-2">
              {/* Odds button */}
              <button
                onClick={() => canBet && onBet(pick as 'home' | 'away' | 'draw')}
                disabled={!canBet}
                className={`rounded-xl px-3 py-2.5 text-center transition-all border w-full ${
                  isMyPick
                    ? 'bg-gold-400/15 border-gold-400/40'
                    : canBet
                    ? 'border-cral-border hover:border-gold-500/40 hover:bg-cral-surface cursor-pointer'
                    : 'border-cral-border opacity-60 cursor-default'
                }`}>
                <div className="text-xs text-cral-sub truncate mb-0.5">{label}</div>
                <div className="font-mono font-bold text-sm text-cral-text">{formatAmericanOdds(odds)}</div>
                <div className="text-xs text-cral-muted">×{formatOdds(odds)}</div>
              </button>

              {/* Avatars of players who picked this */}
              {pickBets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center px-1">
                  {pickBets.map((b: any, i: number) => {
                    const p = b.profiles as any
                    return (
                      <div key={i} className="relative group" title={`${p?.username ?? '?'} — ₡${formatCral(b.amount)}`}>
                        <Avatar
                          username={p?.username ?? '?'}
                          avatarColor={p?.avatar_color ?? '#888'}
                          avatarSvg={p?.avatar_svg}
                          size={28}
                          className={b.status === 'won' ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-cral-bg' :
                                     b.status === 'lost' ? 'ring-2 ring-red-400 ring-offset-1 ring-offset-cral-bg opacity-50' : ''}
                        />
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10">
                          <div className="bg-cral-bg border border-cral-border rounded-lg px-2 py-1 text-xs text-cral-text whitespace-nowrap shadow-lg">
                            <div className="font-medium">{p?.username}</div>
                            <div className="text-cral-sub">₡{formatCral(b.amount)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
