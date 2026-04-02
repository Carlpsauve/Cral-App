'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { getMontrealDateString, getTimeUntilReset, SYMBOLS } from '@/lib/slots'
import { formatCral } from '@/lib/utils'
import { Gamepad2, Info } from 'lucide-react'

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

export default function DailyPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [lines, setLines] = useState(3)
  const [betPerLine, setBetPerLine] = useState(1)
  const [result, setResult] = useState<any>(null)
  const [reels, setReels] = useState<string[][]>(Array(5).fill(BLANK_REEL))
  const [spinning, setSpinning] = useState<boolean[]>(Array(5).fill(false))
  const [balance, setBalance] = useState(0)
  const [countdown, setCountdown] = useState('')
  const [error, setError] = useState('')
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
    if (profile) setBalance(profile.balance)
    const today = getMontrealDateString()
    const { data: play } = await supabase
      .from('daily_plays').select('*')
      .eq('user_id', user.id).eq('played_date', today).single()
    if (play) {
      setResult(play)
      // Show the final reels from today's play
      const finalReels: string[][] = Array(5).fill(BLANK_REEL)
      play.result.forEach((r: any, i: number) => { finalReels[i] = r.symbols })
      setReels(finalReels)
      setLines(play.lines_played)
      setBetPerLine(play.bet_per_line)
      setPhase('done')
    } else {
      setPhase('setup')
    }
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

    const res = await fetch('/api/daily/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines, bet_per_line: betPerLine }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erreur serveur')
      setPhase('setup')
      return
    }

    const { result: gameResult, newBalance } = await res.json()

    // Animate each line sequentially
    for (let lineIdx = 0; lineIdx < lines; lineIdx++) {
      setSpinning(prev => { const n = [...prev]; n[lineIdx] = true; return n })

      // Randomize display during spin (12 ticks × 80ms = ~1s)
      for (let tick = 0; tick < 12; tick++) {
        await new Promise(r => setTimeout(r, 80))
        setReels(prev => {
          const n = [...prev]
          n[lineIdx] = Array(3).fill(0).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
          return n
        })
      }

      // Land on result
      setSpinning(prev => { const n = [...prev]; n[lineIdx] = false; return n })
      setReels(prev => {
        const n = [...prev]
        n[lineIdx] = gameResult.lines[lineIdx]?.symbols ?? ['❌', '❌', '❌']
        return n
      })

      await new Promise(r => setTimeout(r, 250))
    }

    setBalance(newBalance)
    setResult(gameResult)
    setPhase('done')
  }

  const totalBet = lines * betPerLine
  const maxBetPerLine = Math.min(10, Math.floor(balance / Math.max(lines, 1)) || 1)
  const lineResults = result?.lines ?? []
  const totalWin = result?.totalWin ?? result?.total_win ?? 0
  const totalBetFinal = result?.totalBet ?? result?.total_bet ?? 0
  const netResult = totalWin - totalBetFinal

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-3">
            <Gamepad2 className="text-gold-400" size={28} />
            Daily Game
          </h1>
          <p className="text-cral-sub text-sm mt-1">Une tentative par jour · Reset minuit (Montréal)</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-gold-400">{countdown}</div>
          <div className="text-xs text-cral-sub">avant le reset</div>
        </div>
      </div>

      {/* Machine */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(180deg, #1a1a26 0%, #12121a 100%)',
        border: '2px solid rgba(251,191,36,0.3)'
      }}>
        {/* Top bar */}
        <div className="bg-gold-500/10 border-b border-gold-500/20 px-6 py-3 flex items-center justify-between">
          <span className="font-display font-bold text-gold-400 tracking-widest uppercase text-sm">Machine à sous</span>
          <span className="font-mono text-sm text-cral-sub">
            Solde: <span className="text-gold-400 font-medium">₡{formatCral(balance)}</span>
          </span>
        </div>

        {/* Reels */}
        <div className="p-6 space-y-2">
          {Array.from({ length: 5 }).map((_, lineIdx) => {
            const isActive = lineIdx < lines
            const lineResult = lineResults[lineIdx]
            const isWin = lineResult && lineResult.win > 0
            const isSpinning = spinning[lineIdx]

            return (
              <div key={lineIdx} className={`flex items-center gap-3 transition-all duration-300 ${!isActive ? 'opacity-25' : ''}`}>
                <div className={`text-xs font-mono w-6 text-right flex-shrink-0 ${isActive ? 'text-gold-500' : 'text-cral-muted'}`}>
                  L{lineIdx + 1}
                </div>
                <div className={`flex-1 grid grid-cols-3 gap-2 rounded-xl p-2.5 transition-all duration-500 ${
                  isWin && !isSpinning ? 'bg-gold-400/15 border border-gold-400/40' :
                  isActive ? 'bg-cral-bg/60 border border-cral-border' : 'bg-transparent'
                }`}>
                  {(reels[lineIdx] ?? BLANK_REEL).map((sym, symIdx) => (
                    <div key={symIdx}
                      className={`text-3xl text-center rounded-lg py-1.5 transition-all duration-100 ${
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
                    {isWin ? `+₡${formatCral(lineResult.win)}` : 'rien'}
                  </div>
                )}
                {isActive && !lineResult && <div className="w-16 flex-shrink-0" />}
              </div>
            )
          })}
        </div>

        {/* Result summary */}
        {phase === 'done' && result && (
          <div className={`mx-6 mb-6 rounded-xl p-4 text-center ${
            netResult > 0 ? 'bg-green-400/10 border border-green-400/30' :
            netResult < 0 ? 'bg-red-400/10 border border-red-400/20' :
            'bg-cral-surface border border-cral-border'
          }`}>
            <div className="text-2xl mb-1">{netResult > 0 ? '🎉' : netResult < 0 ? '😢' : '😐'}</div>
            <div className={`font-mono text-2xl font-bold ${
              netResult > 0 ? 'text-green-400' : netResult < 0 ? 'text-red-400' : 'text-cral-sub'
            }`}>
              {netResult > 0 ? '+' : ''}₡{formatCral(netResult)}
            </div>
            <div className="text-xs text-cral-sub mt-1">
              Mise: ₡{formatCral(totalBetFinal)} · Gain: ₡{formatCral(totalWin)}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="px-6 pb-6">
          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {phase === 'setup' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-cral-sub mb-2">Lignes</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setLines(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-mono font-medium transition-all ${
                          lines === n ? 'bg-gold-500 text-cral-bg' : 'bg-cral-surface text-cral-sub hover:text-cral-text'
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-cral-sub mb-2">
                    Mise/ligne: <span className="text-gold-400 font-mono">₡{formatCral(betPerLine)}</span>
                  </label>
                  <input type="range" min={0.5} max={maxBetPerLine} step={0.5} value={betPerLine}
                    onChange={e => setBetPerLine(parseFloat(e.target.value))}
                    className="w-full mt-2 accent-yellow-400" />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-cral-sub">
                <span>Mise totale: <span className="text-gold-400 font-mono font-medium">₡{formatCral(totalBet)}</span></span>
                <span>Jackpot possible: <span className="text-green-400 font-mono font-medium">₡{formatCral(betPerLine * 50)}</span></span>
              </div>

              <button onClick={handleSpin} disabled={totalBet > balance || balance <= 0}
                className="btn-gold w-full py-4 text-lg font-display font-bold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed">
                🎰 TOURNER
              </button>
            </div>
          )}

          {phase === 'spinning' && (
            <div className="text-center py-4">
              <div className="font-display text-lg font-bold text-gold-400 animate-pulse">Bonne chance…</div>
            </div>
          )}

          {phase === 'done' && (
            <div className="text-center text-sm text-cral-sub">
              Revenez demain · Reset dans <span className="text-gold-400 font-mono font-medium">{countdown}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payout table */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Info size={14} className="text-cral-sub" />
          <span className="text-sm font-medium text-cral-text">Tableau des gains (multiplicateur de la mise)</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PAYOUTS.map(p => (
            <div key={p.label} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-cral-surface">
              <span className="text-cral-sub">{p.label}</span>
              <span className={`font-mono font-bold ${
                p.mult.includes('50') || p.mult.includes('20') || p.mult.includes('15') ? 'text-gold-400' :
                p.mult.includes('10') || p.mult.includes('8') ? 'text-green-400' : 'text-cral-text'
              }`}>{p.mult}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-cral-muted text-center mt-3">
          Retour espéré ≈ 75% · Jackpot 💎💎💎 ≈ 0.08% de chance
        </div>
      </div>
    </div>
  )
}
