'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { handValue, type Card } from '@/lib/blackjack'
import { formatCral } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Phase = 'bet' | 'playing' | 'result'

const RESULT_META: Record<string, { label: string; color: string; emoji: string }> = {
  blackjack: { label: 'BLACKJACK!',  color: 'text-gold-400',   emoji: '🎉' },
  win:        { label: 'Gagné!',      color: 'text-green-400',  emoji: '✅' },
  push:       { label: 'Égalité',     color: 'text-blue-400',   emoji: '🤝' },
  loss:       { label: 'Perdu',       color: 'text-red-400',    emoji: '❌' },
  bust:       { label: 'Bust!',       color: 'text-red-400',    emoji: '💥' },
}

interface GameState {
  sessionId: string | null
  playerHand: Card[]
  dealerVisible: Card | null
  dealerFull: Card[] | null
  playerValue: number
  dealerValue: number | null
  result: string | null
  netGain: number | null
  canDouble: boolean
  canSplit: boolean
  // Split state
  hand1: Card[] | null
  hand2: Card[] | null
  hand1Value: number
  hand2Value: number
  activeHand: 1 | 2
  splitMode: boolean
  hand1Result: string | null
  hand2Result: string | null
}

const INITIAL: GameState = {
  sessionId: null, playerHand: [], dealerVisible: null, dealerFull: null,
  playerValue: 0, dealerValue: null, result: null, netGain: null,
  canDouble: false, canSplit: false,
  hand1: null, hand2: null, hand1Value: 0, hand2Value: 0,
  activeHand: 1, splitMode: false, hand1Result: null, hand2Result: null,
}

export default function BlackjackPage() {
  const [phase, setPhase] = useState<Phase>('bet')
  const [bet, setBet] = useState(5)
  const [balance, setBalance] = useState(0)
  const [game, setGame] = useState<GameState>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
      if (p) setBalance(p.balance)
    }
    load()
  }, [])

  async function api(path: string, body: object) {
    setError('')
    setLoading(true)
    const res = await fetch(`/api/blackjack/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Erreur serveur'); return null }
    return data
  }

  async function handleDeal() {
    const data = await api('deal', { bet })
    if (!data) return
    setBalance(b => b - bet)
    if (data.finished) {
      // Natural blackjack
      setGame(g => ({
        ...g, playerHand: data.player_hand, dealerFull: data.dealer_full,
        dealerValue: data.dealer_value, playerValue: data.player_value,
        result: data.result, netGain: data.net_gain,
        canDouble: false, canSplit: false, splitMode: false,
      }))
      setBalance(data.new_balance)
      setPhase('result')
    } else {
      setGame({
        ...INITIAL,
        sessionId: data.session_id,
        playerHand: data.player_hand,
        dealerVisible: data.dealer_visible,
        playerValue: data.player_value,
        canDouble: data.can_double,
        canSplit: data.can_split,
      })
      setPhase('playing')
    }
  }

  async function handleHit() {
    if (!game.sessionId) return
    const data = await api('hit', { session_id: game.sessionId })
    if (!data) return
    if (data.finished) {
      setGame(g => ({
        ...g, playerHand: data.player_hand, playerValue: data.player_value,
        dealerFull: data.dealer_full, dealerValue: data.dealer_value,
        result: data.result, netGain: data.net_gain, canDouble: false, canSplit: false,
      }))
      setBalance(data.new_balance)
      setPhase('result')
    } else {
      setGame(g => ({
        ...g, playerHand: data.player_hand, playerValue: data.player_value,
        canDouble: false, canSplit: false,
      }))
    }
  }

  async function handleStand() {
    if (!game.sessionId) return
    const data = await api('stand', { session_id: game.sessionId })
    if (!data) return
    setGame(g => ({
      ...g, dealerFull: data.dealer_full, dealerValue: data.dealer_value,
      playerValue: data.player_value, result: data.result, netGain: data.net_gain,
      canDouble: false, canSplit: false,
    }))
    setBalance(data.new_balance)
    setPhase('result')
  }

  async function handleDouble() {
    if (!game.sessionId) return
    setBalance(b => b - bet)
    const data = await api('double', { session_id: game.sessionId })
    if (!data) return
    setGame(g => ({
      ...g, playerHand: data.player_hand, playerValue: data.player_value,
      dealerFull: data.dealer_full, dealerValue: data.dealer_value,
      result: data.result, netGain: data.net_gain, canDouble: false, canSplit: false,
    }))
    setBalance(data.new_balance)
    setPhase('result')
  }

  async function handleSplit() {
    if (!game.sessionId) return
    setBalance(b => b - bet)
    const data = await api('split', { session_id: game.sessionId })
    if (!data) return
    setGame(g => ({
      ...g, splitMode: true, activeHand: 1,
      hand1: data.hand1, hand2: data.hand2,
      hand1Value: data.hand1_value, hand2Value: data.hand2_value,
      canDouble: false, canSplit: false,
    }))
  }

  function resetGame() {
    setGame(INITIAL)
    setPhase('bet')
    setError('')
  }

  const chipValues = [1, 2, 5, 10, 25, 50, 100]
  const netGain = game.netGain
  const result = game.result

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/jeux" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-cral-card transition-colors text-cral-sub">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text">🃏 Blackjack</h1>
          <p className="text-cral-sub text-sm">Blackjack ×2.5 · Double Down · Split · Illimité</p>
        </div>
        <div className="ml-auto">
          <div className="font-mono text-lg font-bold text-gold-400">₡{formatCral(balance)}</div>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</div>}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(160deg, #1a3a2a 0%, #0f2018 100%)',
        border: '2px solid rgba(52,211,153,0.25)',
      }}>
        <div className="p-6 space-y-6">
          {/* Dealer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-green-300/70 uppercase tracking-wider">Dealer</span>
              {phase === 'result' && game.dealerValue != null && (
                <span className="text-xs font-mono text-green-300">{game.dealerValue}</span>
              )}
              {phase === 'playing' && game.dealerVisible && (
                <span className="text-xs text-green-300/50">{handValue([game.dealerVisible])} + ?</span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap min-h-[90px] items-center">
              {phase === 'bet' && <div className="text-green-300/30 text-sm">En attente...</div>}
              {phase === 'playing' && game.dealerVisible && (
                <>
                  <CardUI card={game.dealerVisible} />
                  <CardUI hidden />
                </>
              )}
              {phase === 'result' && game.dealerFull && game.dealerFull.map((c, i) => (
                <CardUI key={i} card={c} />
              ))}
            </div>
          </div>

          <div className="border-t border-green-900/50" />

          {/* Player hands */}
          {!game.splitMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-green-300/70 uppercase tracking-wider">Vous</span>
                {game.playerValue > 0 && (
                  <span className={`text-xs font-mono ${game.playerValue > 21 ? 'text-red-400' : game.playerValue === 21 ? 'text-gold-400' : 'text-green-300'}`}>
                    {game.playerValue}{game.playerValue > 21 ? ' BUST' : game.playerValue === 21 ? ' 21!' : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap min-h-[90px] items-center">
                {phase === 'bet' && <div className="text-green-300/30 text-sm">En attente...</div>}
                {game.playerHand.map((c, i) => <CardUI key={i} card={c} />)}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2].map(n => {
                const hand = n === 1 ? game.hand1 : game.hand2
                const val = n === 1 ? game.hand1Value : game.hand2Value
                const isActive = game.activeHand === n
                const res = n === 1 ? game.hand1Result : game.hand2Result
                return (
                  <div key={n} className={`space-y-2 rounded-xl p-3 transition-all ${isActive ? 'bg-green-900/30 border border-green-400/20' : 'opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-300/70">Main {n}</span>
                      <span className={`text-xs font-mono ${val > 21 ? 'text-red-400' : val === 21 ? 'text-gold-400' : 'text-green-300'}`}>{val}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap min-h-[80px] items-center">
                      {hand?.map((c, i) => <CardUI key={i} card={c} small />)}
                    </div>
                    {res && <div className={`text-xs text-center font-bold ${res === 'win' || res === 'blackjack' ? 'text-green-400' : res === 'push' ? 'text-blue-400' : 'text-red-400'}`}>
                      {RESULT_META[res]?.emoji} {RESULT_META[res]?.label}
                    </div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Result banner */}
        {phase === 'result' && result && (
          <div className="px-6 pb-4">
            <div className={`rounded-xl p-4 text-center ${
              (netGain ?? 0) > 0 ? 'bg-green-400/15 border border-green-400/30' :
              (netGain ?? 0) < 0 ? 'bg-red-400/15 border border-red-400/20' :
              'bg-blue-400/10 border border-blue-400/20'
            }`}>
              <div className="text-3xl mb-1">{RESULT_META[result]?.emoji}</div>
              <div className={`font-display text-2xl font-bold ${RESULT_META[result]?.color}`}>
                {RESULT_META[result]?.label}
              </div>
              <div className={`font-mono text-xl font-bold mt-1 ${(netGain ?? 0) > 0 ? 'text-green-400' : (netGain ?? 0) < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {netGain === 0 ? 'Mise remboursée' : `${(netGain ?? 0) > 0 ? '+' : ''}₡${formatCral(netGain ?? 0)}`}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="px-6 pb-6 space-y-4">
          {/* Bet phase */}
          {phase === 'bet' && (
            <div className="space-y-4">
              <div className="text-xs text-green-300/70 mb-1">Mise</div>
              <div className="flex flex-wrap gap-2">
                {chipValues.filter(v => v <= Math.floor(balance)).map(v => (
                  <button key={v} onClick={() => setBet(v)}
                    className={`w-12 h-12 rounded-full text-sm font-bold transition-all border-2 ${
                      bet === v ? 'bg-gold-500 border-gold-400 text-cral-bg scale-110' : 'bg-cral-surface border-cral-border text-cral-text hover:border-gold-500/50'
                    }`}>{v}</button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={Math.min(500, Math.floor(balance))} step={1}
                  value={bet} onChange={e => setBet(parseInt(e.target.value))}
                  className="flex-1 accent-yellow-400" />
                <span className="font-mono font-bold text-gold-400 w-20 text-right">₡{formatCral(bet)}</span>
              </div>
              <button onClick={handleDeal} disabled={bet > balance || loading}
                className="btn-gold w-full py-4 text-lg font-display font-bold tracking-wide disabled:opacity-40">
                {loading ? <span className="w-5 h-5 border-2 border-cral-bg/30 border-t-cral-bg rounded-full animate-spin inline-block" /> : '🃏 DISTRIBUER'}
              </button>
            </div>
          )}

          {/* Playing phase */}
          {phase === 'playing' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button onClick={handleHit} disabled={loading}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-blue-500/20 border border-blue-400/40 text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-40">
                  {loading ? '...' : 'Tirer (Hit)'}
                </button>
                <button onClick={handleStand} disabled={loading}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-500/20 border border-red-400/40 text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-40">
                  {loading ? '...' : 'Rester (Stand)'}
                </button>
              </div>
              <div className="flex gap-2">
                {game.canDouble && (
                  <button onClick={handleDouble} disabled={loading}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gold-500/15 border border-gold-400/30 text-gold-400 hover:bg-gold-500/25 transition-all disabled:opacity-40">
                    ×2 Double Down
                  </button>
                )}
                {game.canSplit && (
                  <button onClick={handleSplit} disabled={loading}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-purple-500/15 border border-purple-400/30 text-purple-300 hover:bg-purple-500/25 transition-all disabled:opacity-40">
                    ✂️ Split
                  </button>
                )}
              </div>
              <div className="text-xs text-green-300/40 text-center">
                Mise: ₡{formatCral(bet)}
                {game.canDouble && ' · Double: ₡' + formatCral(bet * 2)}
              </div>
            </div>
          )}

          {/* Result phase */}
          {phase === 'result' && (
            <button onClick={resetGame}
              className="w-full py-3 rounded-xl font-bold text-sm bg-cral-surface border border-cral-border text-cral-text hover:border-gold-500/40 transition-all">
              Nouvelle partie
            </button>
          )}
        </div>
      </div>

      {/* Rules */}
      <div className="card text-xs text-cral-muted space-y-1">
        <div className="font-medium text-cral-sub mb-2">Règles</div>
        <div>Blackjack naturel = ×2.5 · Gagner = ×2 · Égalité = remboursé · Bust = mise perdue</div>
        <div>Double Down: misez double, recevez 1 carte puis le dealer joue</div>
        <div>Split: séparez une paire en 2 mains indépendantes</div>
        <div>Dealer tire jusqu&apos;à 17 · Mise ₡1–₡500 · Parties illimitées</div>
      </div>
    </div>
  )
}

function CardUI({ card, hidden = false, small = false }: { card?: Card; hidden?: boolean; small?: boolean }) {
  const w = small ? 'w-11' : 'w-14'
  const h = small ? 'h-16' : 'h-20'
  const textSm = small ? 'text-[10px]' : 'text-xs'
  const textLg = small ? 'text-base' : 'text-lg'

  if (hidden) {
    return (
      <div className={`${w} ${h} rounded-lg flex items-center justify-center text-xl`}
        style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f2040)', border: '1px solid rgba(96,165,250,0.3)' }}>
        🂠
      </div>
    )
  }
  if (!card) return null
  const isRed = card.suit === '♥' || card.suit === '♦'
  return (
    <div className={`${w} ${h} rounded-lg flex flex-col items-center justify-center gap-0.5 select-none shadow-md`}
      style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className={`${textSm} font-bold leading-none`} style={{ color: isRed ? '#dc2626' : '#1f2937' }}>{card.rank}</div>
      <div className={`${textLg} leading-none`} style={{ color: isRed ? '#dc2626' : '#1f2937' }}>{card.suit}</div>
    </div>
  )
}
