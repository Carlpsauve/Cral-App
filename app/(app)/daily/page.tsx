'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { getMontrealDateString, getTimeUntilReset, SYMBOLS } from '@/lib/slots'
import { formatCral } from '@/lib/utils'
import { Gamepad2, Info, Zap, Gift, Crown } from 'lucide-react'

type SpinMode = 'free' | 'paid'
type Phase = 'loading' | 'setup' | 'spinning' | 'done'

const PAYOUTS = [
  { label: 'JACKPOT 💎💎💎', mult: '×50' },
  { label: 'Triple 💰💰💰', mult: '×15' },
  { label: 'Triple 7️⃣7️⃣7️⃣', mult: '×20' },
  { label: 'Triple ⭐⭐⭐', mult: '×10' },
  { label: 'Triple 🔔🔔🔔', mult: '×8' },
  { label: 'Triple 🍒🍒🍒', mult: '×6' },
  { label: 'Paire 💎', mult: '×2' },
  { label: 'Paire 7️⃣', mult: '×1.5' },
  { label: 'Paire autre', mult: '×1.2' },
  { label: 'Une 🍒', mult: '×0.5' },
]

const BLANK_REEL = ['🎰', '🎰', '🎰']

interface PlayState {
  hasPlayedFree: boolean
  hasPlayedPaid: boolean
  freeResult: any
  paidResults: any[]
}

export default function DailyPage() {
  const [mode, setMode] = useState<SpinMode>('free')
  const [phase, setPhase] = useState<Phase>('loading')
  const [lines, setLines] = useState(3)
  const [betPerLine, setBetPerLine] = useState(1)
  const [lastResult, setLastResult] = useState<any>(null)
  const [reels, setReels] = useState<string[][]>(Array(5).fill(BLANK_REEL))
  const [spinning, setSpinning] = useState<boolean[]>(Array(5).fill(false))
  const [balance, setBalance] = useState(0)
  const [role, setRole] = useState<string>('plebe')
  const [countdown, setCountdown] = useState('')
  const [error, setError] = useState('')
  const [playState, setPlayState] = useState<PlayState>({
    hasPlayedFree: false,
    hasPlayedPaid: false,
    freeResult: null,
    paidResults: [],
  })
  const [upgradingHBC, setUpgradingHBC] = useState(false)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)
  const supabase = createClient()

  const isHBC = role === 'homme_blanc_chauve' || role === 'super_admin'

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('balance, role').eq('id', user.id).single()
    if (profile) {
      setBalance(profile.balance)
      setRole(profile.role)
    }

    const today = getMontrealDateString()
    const { data: plays } = await supabase
      .from('daily_plays').select('*')
      .eq('user_id', user.id).eq('played_date', today)

    const freePlays = plays?.filter((p: any) => p.is_free_bet) ?? []
    const paidPlays = plays?.filter((p: any) => !p.is_free_bet) ?? []

    const hasPlayedFree = freePlays.length > 0
    const hasPlayedPaid = paidPlays.length > 0 && profile?.role !== 'homme_blanc_chauve' && profile?.role !== 'super_admin'

    setPlayState({
      hasPlayedFree,
      hasPlayedPaid,
      freeResult: freePlays[0] ?? null,
      paidResults: paidPlays,
    })

    // Default mode selection
    if (!hasPlayedFree) setMode('free')
    else if (!hasPlayedPaid || profile?.role === 'homme_blanc_chauve' || profile?.role === 'super_admin') setMode('paid')

    setPhase('setup')
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => setCountdown(getTimeUntilReset()), 1000)
    setCountdown(getTimeUntilReset())
    return () => clearInterval(timer)
  }, [load])

  async function handleSpin() {
    setError('')
    setPhase('spinning')

    const body = mode === 'free'
      ? { is_free_bet: true }
      : { lines, bet_per_line: betPerLine, is_free_bet: false }

    const res = await fetch('/api/daily/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erreur serveur')
      setPhase('setup')
      return
    }

    const { result: gameResult, newBalance } = await res.json()
    if (mode === 'paid') {
      fetch('/api/bounties/progress', { method: 'POST', body: JSON.stringify({ type: 'slots' }) }).catch(e => console.error(e));
    }
    const linesPlayed = mode === 'free' ? 1 : lines

    // Animate each line
    for (let lineIdx = 0; lineIdx < linesPlayed; lineIdx++) {
      setSpinning(prev => { const n = [...prev]; n[lineIdx] = true; return n })
      for (let tick = 0; tick < 12; tick++) {
        await new Promise(r => setTimeout(r, 80))
        setReels(prev => {
          const n = [...prev]
          n[lineIdx] = Array(3).fill(0).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
          return n
        })
      }
      setSpinning(prev => { const n = [...prev]; n[lineIdx] = false; return n })
      setReels(prev => {
        const n = [...prev]
        n[lineIdx] = gameResult.lines[lineIdx]?.symbols ?? ['❌', '❌', '❌']
        return n
      })
      await new Promise(r => setTimeout(r, 250))
    }

    setBalance(newBalance)
    setLastResult(gameResult)

    if (mode === 'free') {
      setPlayState(prev => ({ ...prev, hasPlayedFree: true, freeResult: gameResult }))
    } else {
      setPlayState(prev => ({
        ...prev,
        hasPlayedPaid: !isHBC ? true : prev.hasPlayedPaid,
        paidResults: [...prev.paidResults, gameResult],
      }))
    }

    setPhase('setup')
  }

  async function handleUpgradeHBC() {
    if (!confirm('Devenir Homme Blanc Chauve pour ₡200? Cela donne des spins payants illimités par jour!')) return
    setUpgradingHBC(true)
    setError('')
    const res = await fetch('/api/profile/upgrade-hbc', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setBalance(data.newBalance)
      setRole('homme_blanc_chauve')
      setUpgradeSuccess(true)
      setTimeout(() => setUpgradeSuccess(false), 4000)
    }
    setUpgradingHBC(false)
  }

  const linesPlayed = mode === 'free' ? 1 : lines
  const totalBet = mode === 'free' ? 0 : lines * betPerLine
  const maxBetPerLine = Math.min(10, Math.floor(balance / Math.max(lines, 1)) || 1)
  const lineResults = lastResult?.lines ?? []

  const canSpinFree = !playState.hasPlayedFree
  const canSpinPaid = isHBC || !playState.hasPlayedPaid

  const bothDone = playState.hasPlayedFree && !canSpinPaid

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-3">
            <Gamepad2 className="text-gold-400" size={28} />
            Daily Game
          </h1>
          <p className="text-cral-sub text-sm mt-1">
            {isHBC
              ? '🦲 Spins illimités · Free bet 1×/jour · Reset minuit (Montréal)'
              : 'Free bet 1×/jour · 1 spin payant/jour · Reset minuit (Montréal)'}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-gold-400">{countdown}</div>
          <div className="text-xs text-cral-sub">avant le reset</div>
        </div>
      </div>

      {/* HBC upgrade success */}
      {upgradeSuccess && (
        <div className="rounded-xl p-4 text-center" style={{
          background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(251,191,36,0.1))',
          border: '1px solid rgba(167,139,250,0.4)'
        }}>
          <div className="text-3xl mb-1">🦲</div>
          <div className="font-display font-bold text-purple-300">Vous êtes maintenant Homme Blanc Chauve!</div>
          <div className="text-xs text-cral-sub mt-1">Spins payants illimités débloqués pour toujours</div>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode('free'); setLastResult(null); setReels(Array(5).fill(BLANK_REEL)) }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border ${
            mode === 'free'
              ? 'bg-green-400/15 border-green-400/40 text-green-400'
              : 'border-cral-border text-cral-sub hover:border-cral-muted'
          }`}
        >
          <Gift size={15} />
          Free Bet
          {playState.hasPlayedFree && <span className="text-xs opacity-60">(utilisé)</span>}
        </button>
        <button
          onClick={() => { setMode('paid'); setLastResult(null); setReels(Array(5).fill(BLANK_REEL)) }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border ${
            mode === 'paid'
              ? isHBC
                ? 'bg-purple-400/15 border-purple-400/40 text-purple-300'
                : 'bg-gold-400/15 border-gold-400/40 text-gold-400'
              : 'border-cral-border text-cral-sub hover:border-cral-muted'
          }`}
        >
          {isHBC ? <Crown size={15} /> : <Zap size={15} />}
          Spin payant
          {isHBC && <span className="text-xs opacity-80">∞</span>}
          {!isHBC && playState.hasPlayedPaid && <span className="text-xs opacity-60">(utilisé)</span>}
        </button>
      </div>

      {/* Machine */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(180deg, #1a1a26 0%, #12121a 100%)',
        border: `2px solid ${
          mode === 'free' ? 'rgba(52,211,153,0.35)' :
          isHBC ? 'rgba(167,139,250,0.35)' :
          'rgba(251,191,36,0.3)'
        }`
      }}>
        {/* Top bar */}
        <div className={`border-b px-6 py-3 flex items-center justify-between ${
          mode === 'free' ? 'bg-green-400/10 border-green-400/20' :
          isHBC ? 'bg-purple-400/10 border-purple-400/20' :
          'bg-gold-500/10 border-gold-500/20'
        }`}>
          <div className="flex items-center gap-2">
            {mode === 'free'
              ? <><Gift size={14} className="text-green-400" /><span className="font-display font-bold text-green-400 tracking-widest uppercase text-sm">Free Bet</span></>
              : isHBC
              ? <><Crown size={14} className="text-purple-300" /><span className="font-display font-bold text-purple-300 tracking-widest uppercase text-sm">HBC — Illimité</span></>
              : <><Zap size={14} className="text-gold-400" /><span className="font-display font-bold text-gold-400 tracking-widest uppercase text-sm">Machine à sous</span></>
            }
          </div>
          <span className="font-mono text-sm text-cral-sub">
            Solde: <span className={`font-medium ${isHBC && mode === 'paid' ? 'text-purple-300' : 'text-gold-400'}`}>₡{formatCral(balance)}</span>
          </span>
        </div>

        {/* Reels */}
        <div className="p-6 space-y-2">
          {Array.from({ length: 5 }).map((_, lineIdx) => {
            const isActive = lineIdx < linesPlayed
            const lineResult = lineResults[lineIdx]
            const isWin = lineResult && lineResult.win > 0
            const isSpinning = spinning[lineIdx]
            return (
              <div key={lineIdx} className={`flex items-center gap-3 transition-all duration-300 ${!isActive ? 'opacity-20' : ''}`}>
                <div className={`text-xs font-mono w-6 text-right flex-shrink-0 ${
                  isActive ? (mode === 'free' ? 'text-green-500' : isHBC ? 'text-purple-400' : 'text-gold-500') : 'text-cral-muted'
                }`}>
                  {mode === 'free' ? '🆓' : `L${lineIdx + 1}`}
                </div>
                <div className={`flex-1 grid grid-cols-3 gap-2 rounded-xl p-2.5 transition-all duration-500 ${
                  isWin && !isSpinning ? 'bg-gold-400/15 border border-gold-400/40' :
                  isActive ? 'bg-cral-bg/60 border border-cral-border' : 'bg-transparent'
                }`}>
                  {(reels[lineIdx] ?? BLANK_REEL).map((sym, symIdx) => (
                    <div key={symIdx} className={`text-3xl text-center rounded-lg py-1.5 transition-all duration-100 ${
                      isSpinning ? 'blur-sm scale-90 opacity-70' : 'scale-100 opacity-100'
                    } ${isActive ? 'bg-cral-surface' : ''}`}>
                      {isActive ? sym : '—'}
                    </div>
                  ))}
                </div>
                {isActive && lineResult && !isSpinning && (
                  <div className={`text-xs font-mono w-16 text-right flex-shrink-0 font-medium ${
                    isWin ? 'text-green-400' : 'text-red-400/50'
                  }`}>
                    {isWin ? `+₡${formatCral(lineResult.win)}` : mode === 'free' ? 'rien' : 'rien'}
                  </div>
                )}
                {isActive && !lineResult && <div className="w-16 flex-shrink-0" />}
              </div>
            )
          })}
        </div>

        {/* Result */}
        {lastResult && phase !== 'spinning' && (() => {
          const totalWin = lastResult.totalWin ?? 0
          const totalBetFinal = mode === 'free' ? 0 : (lastResult.totalBet ?? 0)
          const net = totalWin - totalBetFinal
          return (
            <div className={`mx-6 mb-6 rounded-xl p-4 text-center ${
              net > 0 ? 'bg-green-400/10 border border-green-400/30' :
              net < 0 ? 'bg-red-400/10 border border-red-400/20' :
              'bg-cral-surface border border-cral-border'
            }`}>
              <div className="text-2xl mb-1">{net > 0 ? '🎉' : net < 0 ? '😢' : '😐'}</div>
              <div className={`font-mono text-2xl font-bold ${
                net > 0 ? 'text-green-400' : net < 0 ? 'text-red-400' : 'text-cral-sub'
              }`}>
                {net > 0 ? '+' : ''}₡{formatCral(net)}
              </div>
              <div className="text-xs text-cral-sub mt-1">
                {mode === 'free'
                  ? `Free bet · Gain: ₡${formatCral(totalWin)}`
                  : `Mise: ₡${formatCral(totalBetFinal)} · Gain: ₡${formatCral(totalWin)}`
                }
              </div>
            </div>
          )
        })()}

        {/* Controls */}
        <div className="px-6 pb-6 space-y-4">
          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</div>
          )}

          {phase !== 'spinning' && (
            <>
              {/* Free bet controls */}
              {mode === 'free' && (
                <div className="space-y-3">
                  {canSpinFree ? (
                    <>
                      <div className="rounded-lg bg-green-400/8 border border-green-400/20 px-4 py-3 text-xs text-green-400">
                        🎁 <strong>Free bet quotidien</strong> — 1 ligne · mise ₡1 · 100% gratuit · gain si vous gagnez!
                      </div>
                      <button onClick={handleSpin}
                        className="w-full py-4 text-lg font-display font-bold rounded-xl transition-all"
                        style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}>
                        🎁 SPIN GRATUIT
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-3 text-cral-sub text-sm">
                      Free bet utilisé aujourd&apos;hui ✓
                      <div className="text-xs text-cral-muted mt-1">Reset dans <span className="text-gold-400 font-mono">{countdown}</span></div>
                    </div>
                  )}
                </div>
              )}

              {/* Paid spin controls */}
              {mode === 'paid' && (
                <div className="space-y-4">
                  {canSpinPaid ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-cral-sub mb-2">Lignes</label>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(n => (
                              <button key={n} onClick={() => setLines(n)}
                                className={`flex-1 py-2 rounded-lg text-sm font-mono font-medium transition-all ${
                                  lines === n
                                    ? isHBC ? 'bg-purple-500 text-white' : 'bg-gold-500 text-cral-bg'
                                    : 'bg-cral-surface text-cral-sub hover:text-cral-text'
                                }`}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-cral-sub mb-2">
                            Mise/ligne: <span className={`font-mono ${isHBC ? 'text-purple-300' : 'text-gold-400'}`}>₡{formatCral(betPerLine)}</span>
                          </label>
                          <input type="range" min={0.5} max={maxBetPerLine} step={0.5} value={betPerLine}
                            onChange={e => setBetPerLine(parseFloat(e.target.value))}
                            className="w-full mt-2 accent-yellow-400" />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-cral-sub">
                        <span>Mise totale: <span className={`font-mono font-medium ${isHBC ? 'text-purple-300' : 'text-gold-400'}`}>₡{formatCral(totalBet)}</span></span>
                        {isHBC && <span className="text-purple-400 text-xs">🦲 Spin #{playState.paidResults.length + 1} aujourd&apos;hui</span>}
                      </div>
                      <button onClick={handleSpin} disabled={totalBet > balance}
                        className={`w-full py-4 text-lg font-display font-bold tracking-wide rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                          isHBC
                            ? 'bg-purple-500/20 border border-purple-400/40 text-purple-300 hover:bg-purple-500/30'
                            : 'btn-gold'
                        }`}>
                        {isHBC ? '🦲 SPIN HBC' : '🎰 TOURNER'}
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-3 space-y-2">
                      <div className="text-cral-sub text-sm">Spin payant utilisé aujourd&apos;hui ✓</div>
                      <div className="text-xs text-cral-muted">Reset dans <span className="text-gold-400 font-mono">{countdown}</span></div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {phase === 'spinning' && (
            <div className="text-center py-4">
              <div className={`font-display text-lg font-bold animate-pulse ${
                mode === 'free' ? 'text-green-400' : isHBC ? 'text-purple-300' : 'text-gold-400'
              }`}>Bonne chance…</div>
            </div>
          )}
        </div>
      </div>

      {/* HBC upgrade card */}
      {role === 'plebe' && (
        <div className="rounded-xl p-5 space-y-3" style={{
          background: 'rgba(167,139,250,0.06)',
          border: '1px solid rgba(167,139,250,0.25)'
        }}>
          <div className="flex items-start gap-3">
            <div className="text-3xl flex-shrink-0">🦲</div>
            <div className="flex-1">
              <div className="font-display font-bold text-purple-300 text-base">Homme Blanc Chauve</div>
              <div className="text-xs text-cral-sub mt-1 leading-relaxed">
                Débloquez les spins payants <strong className="text-cral-text">illimités</strong> par jour.
                Le free bet reste 1× par jour. Statut permanent.
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono font-bold text-purple-300 text-lg">₡200</div>
              <div className="text-xs text-cral-muted">one-time</div>
            </div>
          </div>
          <button
            onClick={handleUpgradeHBC}
            disabled={upgradingHBC || balance < 200}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(167,139,250,0.2)',
              border: '1px solid rgba(167,139,250,0.4)',
              color: '#c4b5fd'
            }}
          >
            {upgradingHBC
              ? <span className="flex items-center justify-center gap-2"><span className="w-3 h-3 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />Traitement...</span>
              : balance < 200
              ? `Solde insuffisant (₡${formatCral(balance)} / ₡200)`
              : '🦲 Devenir Homme Blanc Chauve — ₡200'
            }
          </button>
        </div>
      )}

      {/* HBC badge if already upgraded */}
      {isHBC && role !== 'super_admin' && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{
          background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)'
        }}>
          <span className="text-2xl">🦲</span>
          <div>
            <div className="text-sm font-medium text-purple-300">Homme Blanc Chauve actif</div>
            <div className="text-xs text-cral-sub">Spins payants illimités · Free bet 1×/jour</div>
          </div>
        </div>
      )}

      {/* Payout table */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Info size={14} className="text-cral-sub" />
          <span className="text-sm font-medium text-cral-text">Tableau des gains (×mise)</span>
          <span className="text-xs text-green-400 ml-auto">Free bet: mise = ₡1</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PAYOUTS.map(p => (
            <div key={p.label} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-cral-surface">
              <span className="text-cral-sub">{p.label}</span>
              <span className={`font-mono font-bold ${
                ['×50','×20','×15'].includes(p.mult) ? 'text-gold-400' :
                ['×10','×8'].includes(p.mult) ? 'text-green-400' : 'text-cral-text'
              }`}>{p.mult}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-cral-muted text-center mt-3">
          Retour espéré ≈ 75% · Jackpot 💎💎💎 ≈ 0.08%
        </div>
      </div>
    </div>
  )
}
