'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { createDeck, handValue, isBust, isBlackjack, type Card } from '@/lib/blackjack'
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
  standing:   { label: 'Posé',        color: 'text-cral-muted', emoji: '✋' },
}

interface SplitState {
  hand1: Card[]
  hand2: Card[]
  hand1Value: number
  hand2Value: number
  activeHand: 1 | 2
  hand1Result: string | null
  hand2Result: string | null
  hand1Net: number | null
  hand2Net: number | null
}

export default function BlackjackPage() {
  const [phase, setPhase] = useState<Phase>('bet')
  const [bet, setBet] = useState(5)
  const [balance, setBalance] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [playerValue, setPlayerValue] = useState(0)
  const [dealerVisible, setDealerVisible] = useState<Card | null>(null)
  const [dealerFull, setDealerFull] = useState<Card[]>([])
  const [dealerValue, setDealerValue] = useState<number | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [netGain, setNetGain] = useState<number | null>(null)
  const [canDouble, setCanDouble] = useState(false)
  const [canSplit, setCanSplit] = useState(false)
  const [split, setSplit] = useState<SplitState | null>(null)
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
    if (!res.ok) { setError(data.error ?? 'Erreur'); return null }
    return data
  }

  async function handleDeal() {
    const data = await api('deal', { bet })
    if (!data) return
    setBalance(b => b - bet)
    setSplit(null)
    setDealerFull([])
    setResult(null)
    setNetGain(null)

    if (data.finished) {
      setPlayerHand(data.player_hand)
      setPlayerValue(data.player_value)
      setDealerFull(data.dealer_full)
      setDealerValue(data.dealer_value)
      setResult(data.result)
      setNetGain(data.net_gain)
      setBalance(data.new_balance)
      setPhase('result')
    } else {
      setSessionId(data.session_id)
      setPlayerHand(data.player_hand)
      setPlayerValue(data.player_value)
      setDealerVisible(data.dealer_visible)
      setDealerValue(null)
      setCanDouble(data.can_double)
      setCanSplit(data.can_split)
      setPhase('playing')
    }
  }

  async function handleHit() {
    if (!sessionId) return
    const data = await api('hit', { session_id: sessionId })
    if (!data) return

    if (split) {
      // In split mode
      if (data.finished) {
        // Both hands done
        setDealerFull(data.dealer_full ?? [])
        setDealerValue(data.dealer_value ?? null)
        setNetGain(data.net_gain)
        setBalance(data.new_balance)
        setSplit(s => s ? {
          ...s,
          [split.activeHand === 1 ? 'hand1' : 'hand2']: split.activeHand === 1 ? data.hand1 : data.hand2,
          [split.activeHand === 1 ? 'hand1Value' : 'hand2Value']: split.activeHand === 1 ? data.hand1_value : data.hand2_value,
          hand1Result: data.hand1_result ?? s.hand1Result,
          hand2Result: data.hand2_result ?? data.result ?? 'bust',
          hand1Net: data.hand1_net ?? s.hand1Net, // <-- CORRECTIF NET
          hand2Net: data.hand2_net ?? null,      // <-- CORRECTIF NET
        } : s)
        setPhase('result')
      } else if (data.split_continue) {
        // Hand 1 busted, move to hand 2
        setSplit(s => s ? {
          ...s,
          hand1: data.hand1,
          hand1Value: data.hand1_value,
          hand2: data.hand2,
          hand2Value: data.hand2_value,
          activeHand: 2,
          hand1Result: 'bust',
        } : s)
      } else if (split.activeHand === 1) {
        setSplit(s => s ? { ...s, hand1: data.hand1, hand1Value: data.hand1_value } : s)
      } else {
        setSplit(s => s ? { ...s, hand2: data.hand2, hand2Value: data.hand2_value } : s)
      }
    } else {
      // Normal mode
      if (data.finished) {
        setPlayerHand(data.hand1 ?? data.player_hand ?? playerHand)
        setPlayerValue(data.hand1_value ?? data.player_value ?? playerValue)
        setDealerFull(data.dealer_full ?? [])
        setDealerValue(data.dealer_value ?? null)
        setResult(data.result)
        setNetGain(data.net_gain)
        setBalance(data.new_balance)
        setPhase('result')
      } else {
        setPlayerHand(data.hand1 ?? playerHand)
        setPlayerValue(data.hand1_value ?? playerValue)
        setCanDouble(false)
        setCanSplit(false)
      }
    }
  }

  async function handleStand() {
    if (!sessionId) return
    const data = await api('stand', { session_id: sessionId })
    if (!data) return

    if (data.split_continue) {
      // Stood on hand 1, move to hand 2
      setSplit(s => s ? {
        ...s,
        activeHand: 2,
        hand1Result: 'standing',
        hand2: data.hand2,
        hand2Value: data.hand2_value,
      } : s)
    } else if (data.finished) {
      setDealerFull(data.dealer_full ?? [])
      setDealerValue(data.dealer_value ?? null)
      if (split) {
        setSplit(s => s ? {
          ...s,
          hand1Result: data.hand1_result ?? s.hand1Result,
          hand2Result: data.hand2_result,
          hand1Net: data.hand1_net,
          hand2Net: data.hand2_net,
        } : s)
        setNetGain(data.net_gain)
      } else {
        setResult(data.result)
        setNetGain(data.net_gain)
        setPlayerValue(data.player_value)
      }
      if (data.new_balance != null) setBalance(data.new_balance)
      setPhase('result')
    }
  }

  async function handleDouble() {
    if (!sessionId) return
    setBalance(b => b - bet)
    const data = await api('double', { session_id: sessionId })
    if (!data) return
    setPlayerHand(data.player_hand)
    setPlayerValue(data.player_value)
    setDealerFull(data.dealer_full)
    setDealerValue(data.dealer_value)
    setResult(data.result)
    setNetGain(data.net_gain)
    setBalance(data.new_balance)
    setPhase('result')
  }

  async function handleSplit() {
    if (!sessionId) return
    setBalance(b => b - bet)
    const data = await api('split', { session_id: sessionId })
    if (!data) return
    setSplit({
      hand1: data.hand1,
      hand2: data.hand2,
      hand1Value: data.hand1_value,
      hand2Value: data.hand2_value,
      activeHand: 1,
      hand1Result: null,
      hand2Result: null,
      hand1Net: null,
      hand2Net: null,
    })
    setCanDouble(false)
    setCanSplit(false)
  }

  function resetGame() {
    setSplit(null)
    setPlayerHand([])
    setPlayerValue(0)
    setDealerVisible(null)
    setDealerFull([])
    setDealerValue(null)
    setResult(null)
    setNetGain(null)
    setCanDouble(false)
    setCanSplit(false)
    setSessionId(null)
    setError('')
    setPhase('bet')
  }

  const chipValues = [1, 2, 5, 10, 25, 50, 100]
  const isSplitMode = !!split
  const activeHand = split?.activeHand ?? 1

  // Total net for result display
  const totalNet = isSplitMode
    ? ((split.hand1Net ?? 0) + (split.hand2Net ?? 0))
    : netGain ?? 0

  // Summary result label for split
  const splitSummary = isSplitMode && phase === 'result' && split ? (() => {
    const nets = [split.hand1Net ?? 0, split.hand2Net ?? 0]
    const won = nets.filter(n => n > 0).length
    const lost = nets.filter(n => n < 0).length
    if (won === 2) return { label: 'Double victoire!', emoji: '🎉', color: 'text-green-400' }
    if (won === 1 && lost === 1) return { label: 'Split — 1/2', emoji: '🤝', color: 'text-blue-400' }
    return { label: 'Double défaite', emoji: '❌', color: 'text-red-400' }
  })() : null

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
          {isSplitMode && phase === 'playing' && (
            <div className="text-xs text-cral-muted text-right">Main {activeHand}/2</div>
          )}
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
              {phase === 'result' && dealerValue != null && (
                <span className={`text-xs font-mono ${dealerValue > 21 ? 'text-red-400' : 'text-green-300'}`}>
                  {dealerValue}{dealerValue > 21 ? ' — Bust!' : ''}
                </span>
              )}
              {phase === 'playing' && dealerVisible && (
                <span className="text-xs text-green-300/50">{handValue([dealerVisible])} + ?</span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap min-h-[90px] items-center">
              {phase === 'bet' && <div className="text-green-300/30 text-sm">En attente...</div>}
              {phase === 'playing' && dealerVisible && (
                <><CardUI card={dealerVisible} /><CardUI hidden /></>
              )}
              {phase === 'result' && dealerFull.map((c, i) => <CardUI key={i} card={c} />)}
            </div>
          </div>

          <div className="border-t border-green-900/50" />

          {/* Player hands */}
          {!isSplitMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-green-300/70 uppercase tracking-wider">Vous</span>
                {playerValue > 0 && (
                  <span className={`text-xs font-mono ${playerValue > 21 ? 'text-red-400' : playerValue === 21 ? 'text-gold-400' : 'text-green-300'}`}>
                    {playerValue}{playerValue > 21 ? ' BUST' : playerValue === 21 ? ' 21!' : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap min-h-[90px] items-center">
                {phase === 'bet' && <div className="text-green-300/30 text-sm">En attente...</div>}
                {playerHand.map((c, i) => <CardUI key={i} card={c} />)}
              </div>
            </div>
          ) : (
            /* Split: two hands side by side */
            <div className="grid grid-cols-2 gap-3">
              {([1, 2] as const).map(n => {
                const hand = n === 1 ? split.hand1 : split.hand2
                const val = n === 1 ? split.hand1Value : split.hand2Value
                const isActive = activeHand === n && phase === 'playing'
                const handResult = n === 1 ? split.hand1Result : split.hand2Result
                const handNet = n === 1 ? split.hand1Net : split.hand2Net
                const isDone = handResult !== null && handResult !== 'standing'

                return (
                  <div key={n} className={`rounded-xl p-3 transition-all space-y-2 ${
                    isActive
                      ? 'border-2 border-green-400/40 bg-green-900/20'
                      : isDone
                      ? 'opacity-70 border border-cral-border'
                      : 'border border-cral-border/50 opacity-60'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-green-300/70">
                        Main {n} {isActive ? '← active' : ''}
                      </span>
                      <span className={`text-xs font-mono ${val > 21 ? 'text-red-400' : val === 21 ? 'text-gold-400' : 'text-green-300'}`}>
                        {val}{val > 21 ? ' BUST' : val === 21 ? ' 21!' : ''}
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap min-h-[70px] items-center">
                      {hand.map((c, i) => <CardUI key={i} card={c} small />)}
                    </div>
                    {handResult && handResult !== 'standing' && (
                      <div className={`text-xs text-center font-bold ${
                        handResult === 'win' || handResult === 'blackjack' ? 'text-green-400' :
                        handResult === 'push' ? 'text-blue-400' : 'text-red-400'
                      }`}>
                        {RESULT_META[handResult]?.emoji} {RESULT_META[handResult]?.label}
                        {handNet != null && <span className="ml-1">({handNet > 0 ? '+' : ''}₡{formatCral(handNet)})</span>}
                      </div>
                    )}
                    {handResult === 'standing' && (
                      <div className="text-xs text-center text-cral-muted">✋ Posé</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Result banner */}
        {phase === 'result' && (
          <div className="px-6 pb-4">
            {splitSummary ? (
              <div className={`rounded-xl p-4 text-center ${
                totalNet > 0 ? 'bg-green-400/15 border border-green-400/30' :
                totalNet < 0 ? 'bg-red-400/15 border border-red-400/20' :
                'bg-blue-400/10 border border-blue-400/20'
              }`}>
                <div className="text-3xl mb-1">{splitSummary.emoji}</div>
                <div className={`font-display text-xl font-bold ${splitSummary.color}`}>{splitSummary.label}</div>
                <div className={`font-mono text-xl font-bold mt-1 ${totalNet > 0 ? 'text-green-400' : totalNet < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {totalNet === 0 ? 'Égalité' : `${totalNet > 0 ? '+' : ''}₡${formatCral(totalNet)}`}
                </div>
              </div>
            ) : result ? (
              <div className={`rounded-xl p-4 text-center ${
                totalNet > 0 ? 'bg-green-400/15 border border-green-400/30' :
                totalNet < 0 ? 'bg-red-400/15 border border-red-400/20' :
                'bg-blue-400/10 border border-blue-400/20'
              }`}>
                <div className="text-3xl mb-1">{RESULT_META[result]?.emoji}</div>
                <div className={`font-display text-2xl font-bold ${RESULT_META[result]?.color}`}>
                  {RESULT_META[result]?.label}
                </div>
                <div className={`font-mono text-xl font-bold mt-1 ${totalNet > 0 ? 'text-green-400' : totalNet < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {totalNet === 0 ? 'Mise remboursée' : `${totalNet > 0 ? '+' : ''}₡${formatCral(totalNet)}`}
                </div>
              </div>
            ) : null}
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
              {isSplitMode && (
                <div className="text-xs text-center text-green-300/60 pb-1">
                  Jouez la <strong className="text-green-300">Main {activeHand}</strong> — Hit ou Stand
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleHit} disabled={loading}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-blue-500/20 border border-blue-400/40 text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-40">
                  {loading ? '...' : `Tirer (Hit)`}
                </button>
                <button onClick={handleStand} disabled={loading}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-500/20 border border-red-400/40 text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-40">
                  {loading ? '...' : `Rester (Stand)`}
                </button>
              </div>
              {!isSplitMode && (
                <div className="flex gap-2">
                  {canDouble && (
                    <button onClick={handleDouble} disabled={loading}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gold-500/15 border border-gold-400/30 text-gold-400 hover:bg-gold-500/25 transition-all disabled:opacity-40">
                      ×2 Double Down
                    </button>
                  )}
                  {canSplit && (
                    <button onClick={handleSplit} disabled={loading}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-purple-500/15 border border-purple-400/30 text-purple-300 hover:bg-purple-500/25 transition-all disabled:opacity-40">
                      ✂️ Split (₡{bet})
                    </button>
                  )}
                </div>
              )}
              {!isSplitMode && (canDouble || canSplit) && (
                <div className="text-xs text-green-300/40 text-center">
                  Mise: ₡{formatCral(bet)} · Total si double/split: ₡{formatCral(bet * 2)}
                </div>
              )}
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
        <div>Double Down: misez double, 1 carte puis dealer joue · Split: 2 mains indépendantes</div>
        <div>Dealer tire jusqu&apos;à 17 · Mise ₡1–₡500 · Parties illimitées</div>
      </div>
    </div>
  )
}

function CardUI({ card, hidden = false, small = false }: { card?: Card; hidden?: boolean; small?: boolean }) {
  const w = small ? 'w-11' : 'w-14'
  const h = small ? 'h-16' : 'h-20'
  const rankSize = small ? 'text-[10px]' : 'text-xs'
  const suitSize = small ? 'text-base' : 'text-lg'

  if (hidden) return (
    <div className={`${w} ${h} rounded-lg flex items-center justify-center text-xl`}
      style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f2040)', border: '1px solid rgba(96,165,250,0.3)' }}>
      🂠
    </div>
  )
  if (!card) return null
  const isRed = card.suit === '♥' || card.suit === '♦'
  return (
    <div className={`${w} ${h} rounded-lg flex flex-col items-center justify-center gap-0.5 select-none shadow-sm`}
      style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className={`${rankSize} font-bold leading-none`} style={{ color: isRed ? '#dc2626' : '#1f2937' }}>{card.rank}</div>
      <div className={`${suitSize} leading-none`} style={{ color: isRed ? '#dc2626' : '#1f2937' }}>{card.suit}</div>
    </div>
  )
}
