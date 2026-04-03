'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatCral } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const SEGMENTS = [
  { id: 'one',    label: '1',     multiplier: 1,  color: '#16a34a', textColor: '#fff', darkColor: '#14532d', count: 26 },
  { id: 'three',  label: '3',     multiplier: 3,  color: '#7c3aed', textColor: '#fff', darkColor: '#4c1d95', count: 13 },
  { id: 'six',    label: '6',     multiplier: 6,  color: '#0ea5e9', textColor: '#fff', darkColor: '#075985', count: 7  },
  { id: 'twelve', label: '12',    multiplier: 12, color: '#1d4ed8', textColor: '#fff', darkColor: '#1e3a8a', count: 4  },
  { id: 'tfive',  label: '25',    multiplier: 25, color: '#ca8a04', textColor: '#fff', darkColor: '#78350f', count: 2  },
  { id: 'fifty',  label: '50',    multiplier: 50, color: '#db2777', textColor: '#fff', darkColor: '#831843', count: 1  },
  { id: 'joker',  label: 'JOKER', multiplier: 45, color: '#581c87', textColor: '#fbbf24', darkColor: '#3b0764', count: 1 },
]

// Build interleaved wheel (54 segments, visually balanced)
const WHEEL_ORDER = (() => {
  const bins = SEGMENTS.map(s => Array(s.count).fill(s) as typeof SEGMENTS[0][])
  const result: typeof SEGMENTS[0][] = []
  let i = 0
  while (result.length < 54) {
    const bin = bins[i % bins.length]
    if (bin.length > 0) result.push(bin.pop()!)
    i++
  }
  return result
})()

const NUM_SEGS = WHEEL_ORDER.length // 54
const SEG_DEG = 360 / NUM_SEGS
const SEG_RAD = (2 * Math.PI) / NUM_SEGS

type Phase = 'idle' | 'spinning' | 'result'

// Build SVG path for one wheel segment
function segPath(index: number, inner: number, outer: number, cx: number, cy: number) {
  const start = index * SEG_RAD - Math.PI / 2
  const end = (index + 1) * SEG_RAD - Math.PI / 2
  const x1o = cx + outer * Math.cos(start)
  const y1o = cy + outer * Math.sin(start)
  const x2o = cx + outer * Math.cos(end)
  const y2o = cy + outer * Math.sin(end)
  const x1i = cx + inner * Math.cos(start)
  const y1i = cy + inner * Math.sin(start)
  const x2i = cx + inner * Math.cos(end)
  const y2i = cy + inner * Math.sin(end)
  return `M${x1i},${y1i} L${x1o},${y1o} A${outer},${outer} 0 0,1 ${x2o},${y2o} L${x2i},${y2i} A${inner},${inner} 0 0,0 ${x1i},${y1i} Z`
}

export default function BigCralPage() {
  const [balance, setBalance] = useState(0)
  const [bets, setBets] = useState<Record<string, number>>({})
  const [phase, setPhase] = useState<Phase>('idle')
  const [rotation, setRotation] = useState(0)
  const [landedId, setLandedId] = useState<string | null>(null)
  const [landedLabel, setLandedLabel] = useState('')
  const [landedMult, setLandedMult] = useState(0)
  const [netGain, setNetGain] = useState(0)
  const [chipSize, setChipSize] = useState(5)
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

  const totalBet = Object.values(bets).reduce((s, v) => s + v, 0)

  function placeBet(segId: string, dir: 1 | -1) {
    if (phase !== 'idle') return
    if (dir === 1 && balance - totalBet < chipSize) { setError('Solde insuffisant'); return }
    setError('')
    setBets(prev => {
      const next = { ...prev }
      next[segId] = Math.max(0, (next[segId] ?? 0) + dir * chipSize)
      if (next[segId] === 0) delete next[segId]
      return next
    })
  }

  async function handleSpin() {
    if (phase !== 'idle' || totalBet === 0) return
    setPhase('spinning')
    setError('')
    setLandedId(null)

    const res = await fetch('/api/bigcral/spin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bets }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error); setPhase('idle'); return }

    // Animate to correct segment
    // landed_index = position in WHEEL_ORDER
    const idx = data.landed_index ?? 0
    // Each segment is SEG_DEG degrees. Pointer at top = 0°.
    // Segment at index 0 has its CENTER at SEG_DEG/2 from top.
    // To bring segment idx to the top pointer:
    // rotate so that: rotation + idx * SEG_DEG + SEG_DEG/2 = 360 * n
    // => rotation = 360*n - idx*SEG_DEG - SEG_DEG/2
    const jitter = (Math.random() - 0.5) * SEG_DEG * 0.5
    const toTop = (360 - (idx * SEG_DEG + SEG_DEG / 2) + jitter + 360) % 360
    const targetRotation = rotation + 5 * 360 + toTop

    setRotation(targetRotation)

    setTimeout(() => {
      setLandedId(data.landed)
      setLandedLabel(data.landed_label)
      setLandedMult(data.landed_multiplier)
      setNetGain(data.net_gain)
      setBalance(data.new_balance)
      setPhase('result')
    }, 4500)
  }

  function reset() {
    setBets({})
    setLandedId(null)
    setNetGain(0)
    setPhase('idle')
    setError('')
  }

  // SVG dimensions
  const CX = 180, CY = 180, R_OUTER = 170, R_INNER = 80, R_LABEL = 132

  const landedSeg = SEGMENTS.find(s => s.id === landedId)

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/jeux" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-cral-card transition-colors text-cral-sub">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text">🎡 Big Cral</h1>
          <p className="text-cral-sub text-sm">Roue Big 6 · 54 cases · Joker & 50 au sommet</p>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-lg font-bold text-gold-400">₡{formatCral(balance)}</div>
          {totalBet > 0 && <div className="text-xs text-cral-muted">Misé: ₡{formatCral(totalBet)}</div>}
        </div>
      </div>

      {error && <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</div>}

      {/* Wheel */}
      <div className="card flex flex-col items-center gap-5 py-6">
        <div className="relative" style={{ width: 360, height: 360 }}>
          {/* Pointer */}
          <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: -6 }}>
            <svg width="28" height="28" viewBox="0 0 28 28">
              <polygon points="14,26 2,2 26,2" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Wheel SVG */}
          <svg
            width="360" height="360"
            viewBox="0 0 360 360"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: phase === 'spinning'
                ? 'transform 4.2s cubic-bezier(0.15, 0.5, 0.1, 1.0)'
                : 'none',
              filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.6))',
            }}>

            {/* Outer ring background */}
            <circle cx={CX} cy={CY} r={R_OUTER + 4} fill="#1a1a1a" />

            {/* Segments */}
            {WHEEL_ORDER.map((seg, i) => {
              const midAngle = (i + 0.5) * SEG_RAD - Math.PI / 2
              const lx = CX + R_LABEL * Math.cos(midAngle)
              const ly = CY + R_LABEL * Math.sin(midAngle)
              const textRotDeg = (i + 0.5) * SEG_DEG

              // Alternate slightly lighter/darker shading
              const isEven = i % 2 === 0
              const fillColor = isEven ? seg.color : seg.darkColor

              return (
                <g key={i}>
                  {/* Main segment */}
                  <path
                    d={segPath(i, R_INNER + 2, R_OUTER, CX, CY)}
                    fill={fillColor}
                    stroke="#0a0a0f"
                    strokeWidth="1.2"
                  />
                  {/* Label */}
                  <text
                    x={lx} y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={seg.textColor}
                    fontSize={seg.label.length > 2 ? '10' : '13'}
                    fontWeight="bold"
                    fontFamily="system-ui, sans-serif"
                    transform={`rotate(${textRotDeg + 90}, ${lx}, ${ly})`}
                  >
                    {seg.label}
                  </text>
                  {/* Divider line */}
                  <line
                    x1={CX + (R_INNER + 2) * Math.cos(i * SEG_RAD - Math.PI / 2)}
                    y1={CY + (R_INNER + 2) * Math.sin(i * SEG_RAD - Math.PI / 2)}
                    x2={CX + R_OUTER * Math.cos(i * SEG_RAD - Math.PI / 2)}
                    y2={CY + R_OUTER * Math.sin(i * SEG_RAD - Math.PI / 2)}
                    stroke="#0a0a0f" strokeWidth="1.5"
                  />
                </g>
              )
            })}

            {/* Inner ring decoration */}
            <circle cx={CX} cy={CY} r={R_INNER + 2} fill="#111827" stroke="#374151" strokeWidth="2" />
            <circle cx={CX} cy={CY} r={R_INNER - 4} fill="#0a0a0f" stroke="#fbbf2440" strokeWidth="1" />

            {/* Center label */}
            <text x={CX} y={CY - 8} textAnchor="middle" dominantBaseline="central"
              fill="#fbbf24" fontSize="14" fontWeight="bold" fontFamily="serif">BIG</text>
            <text x={CX} y={CY + 10} textAnchor="middle" dominantBaseline="central"
              fill="#fbbf24" fontSize="14" fontWeight="bold" fontFamily="serif">CRAL</text>
          </svg>

          {/* Outer rim ring */}
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{
            border: `4px solid ${landedSeg?.color ?? '#fbbf24'}`,
            boxShadow: `0 0 24px ${landedSeg?.color ?? 'rgba(251,191,36,0.4)'}`,
            borderRadius: '50%',
            transition: 'border-color 0.5s, box-shadow 0.5s',
          }} />
        </div>

        {/* Result */}
        {phase === 'result' && landedSeg && (
          <div className={`rounded-xl px-6 py-4 text-center w-full max-w-xs ${
            netGain > 0 ? 'bg-green-400/15 border border-green-400/30' :
            netGain < 0 ? 'bg-red-400/15 border border-red-400/20' :
            'bg-cral-surface border border-cral-border'
          }`}>
            <div className="font-display text-2xl font-bold" style={{ color: landedSeg.color }}>
              {landedLabel}
            </div>
            <div className="text-sm text-cral-sub">×{landedMult}</div>
            <div className={`font-mono text-2xl font-bold mt-1 ${netGain > 0 ? 'text-green-400' : netGain < 0 ? 'text-red-400' : 'text-cral-muted'}`}>
              {netGain > 0 ? '+' : ''}{netGain === 0 ? '±' : ''}₡{formatCral(netGain)}
            </div>
          </div>
        )}

        {/* Spin / Reset */}
        {phase === 'idle' && (
          <button onClick={handleSpin} disabled={totalBet === 0}
            className="btn-gold w-full max-w-xs py-4 text-lg font-display font-bold disabled:opacity-40">
            🎡 TOURNER LA ROUE
          </button>
        )}
        {phase === 'spinning' && (
          <div className="flex items-center gap-3 text-cral-sub text-sm py-4">
            <span className="w-5 h-5 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
            La roue tourne...
          </div>
        )}
        {phase === 'result' && (
          <button onClick={reset}
            className="w-full max-w-xs py-3 rounded-xl text-sm font-bold bg-cral-surface border border-cral-border text-cral-text hover:border-gold-500/40 transition-all">
            Nouveau tour
          </button>
        )}
      </div>

      {/* Betting table */}
      <div className="card space-y-4">
        {/* Chip selector */}
        <div>
          <div className="text-xs font-medium text-cral-sub mb-2">Mise par clic</div>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 5, 10, 25, 50].map(v => (
              <button key={v} onClick={() => setChipSize(v)} disabled={phase !== 'idle'}
                className={`w-12 h-12 rounded-full text-sm font-bold border-2 transition-all disabled:opacity-40 ${
                  chipSize === v
                    ? 'bg-gold-500 border-gold-400 text-cral-bg scale-110'
                    : 'bg-cral-surface border-cral-border text-cral-text hover:border-gold-400/40'
                }`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Bet rows */}
        <div className="space-y-2">
          {SEGMENTS.map(seg => {
            const betAmt = bets[seg.id] ?? 0
            const potential = betAmt * (seg.multiplier + 1)
            const isLanded = landedId === seg.id && phase === 'result'
            return (
              <div key={seg.id}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                  isLanded ? 'border-2 bg-opacity-20' : betAmt > 0 ? 'border-cral-border bg-cral-surface' : 'border-transparent'
                }`}
                style={isLanded ? { borderColor: seg.color, backgroundColor: seg.color + '15' } : {}}>

                {/* Color swatch */}
                <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-base font-bold"
                  style={{ backgroundColor: seg.color, color: seg.textColor }}>
                  {seg.label}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-cral-text">×{seg.multiplier}</span>
                    <span className="text-xs text-cral-muted">
                      {seg.count}/54 cases ({((seg.count / 54) * 100).toFixed(1)}%)
                    </span>
                    {isLanded && <span className="text-xs font-bold" style={{ color: seg.color }}>← RÉSULTAT</span>}
                  </div>
                  {betAmt > 0 && (
                    <div className="text-xs text-cral-sub">
                      Mise ₡{formatCral(betAmt)} → <span className="text-green-400 font-mono">₡{formatCral(potential)}</span>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {betAmt > 0 && (
                    <>
                      <button onClick={() => placeBet(seg.id, -1)} disabled={phase !== 'idle'}
                        className="w-8 h-8 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 font-bold text-lg disabled:opacity-40">
                        −
                      </button>
                      <span className="font-mono text-sm font-bold text-gold-400 w-14 text-center">
                        ₡{formatCral(betAmt)}
                      </span>
                    </>
                  )}
                  <button onClick={() => placeBet(seg.id, 1)} disabled={phase !== 'idle'}
                    className="w-8 h-8 rounded-lg font-bold text-lg disabled:opacity-40 transition-colors"
                    style={{ backgroundColor: seg.color + '25', color: seg.color }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = seg.color + '40')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = seg.color + '25')}>
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Total */}
        {totalBet > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-cral-border">
            <div className="text-sm text-cral-sub">
              Total: <span className="font-mono font-bold text-gold-400">₡{formatCral(totalBet)}</span>
            </div>
            <button onClick={() => { setBets({}); setError('') }} disabled={phase !== 'idle'}
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors">
              Effacer tout
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
