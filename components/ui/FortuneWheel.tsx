'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatCral } from '@/lib/utils'
import { getMontrealDateString } from '@/lib/slots'
import { X } from 'lucide-react'

const PRIZES = [
  { amount: 1,    label: '₡1',    color: '#6b7280', bg: '#374151' },
  { amount: 5,    label: '₡5',    color: '#34d399', bg: '#065f46' },
  { amount: 2.5,  label: '₡2.50', color: '#60a5fa', bg: '#1e3a5f' },
  { amount: 10,   label: '₡10',   color: '#fbbf24', bg: '#78350f' },
  { amount: 5,    label: '₡5',    color: '#34d399', bg: '#065f46' },
  { amount: 1,    label: '₡1',    color: '#6b7280', bg: '#374151' },
  { amount: 25,   label: '₡25',   color: '#f97316', bg: '#7c2d12' },
  { amount: 5,    label: '₡5',    color: '#34d399', bg: '#065f46' },
  { amount: 2.5,  label: '₡2.50', color: '#60a5fa', bg: '#1e3a5f' },
  { amount: 5,    label: '₡5',    color: '#34d399', bg: '#065f46' },
  { amount: 10,   label: '₡10',   color: '#fbbf24', bg: '#78350f' },
  { amount: 50,   label: '₡50',   color: '#a78bfa', bg: '#4c1d95' },
]

const NUM_SEGMENTS = PRIZES.length
const SEGMENT_ANGLE = 360 / NUM_SEGMENTS

interface WheelProps {
  onClose: () => void
  onWin: (amount: number, newBalance: number) => void
}

export default function FortuneWheel({ onClose, onWin }: WheelProps) {
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<{ amount: number; newBalance: number } | null>(null)
  const [error, setError] = useState('')
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
  const [alreadyReward, setAlreadyReward] = useState(0)
  const wheelRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    // Check if already played today
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const today = getMontrealDateString()
      const { data } = await supabase.from('daily_wheel').select('reward').eq('user_id', user.id).eq('played_date', today).maybeSingle()
      if (data) {
        setAlreadyPlayed(true)
        setAlreadyReward(data.reward)
      }
    }
    check()
  }, [])

  async function handleSpin() {
    if (spinning || result || alreadyPlayed) return
    setSpinning(true)
    setError('')

    const res = await fetch('/api/wheel/spin', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      if (data.already_played) {
        setAlreadyPlayed(true)
        setAlreadyReward(data.reward)
      } else {
        setError(data.error)
      }
      setSpinning(false)
      return
    }

    // --- NOUVEAU CALCUL SYNCHRONISÉ ---
    
    // 1. Trouver TOUTES les cases visuelles (sur 12) qui correspondent au montant gagné
    const matchingIndices = PRIZES
      .map((p, index) => p.amount === data.reward ? index : -1)
      .filter(index => index !== -1)

    // 2. Choisir une de ces cases au hasard (pour que la roue ne s'arrête pas toujours au même endroit)
    const visualPrizeIdx = matchingIndices[Math.floor(Math.random() * matchingIndices.length)]

    // 3. Calculer l'angle pour que le centre de cette case pointe exactement en haut (à -90° / 12h)
    const centerAngle = visualPrizeIdx * SEGMENT_ANGLE + (SEGMENT_ANGLE / 2)
    const toTop = 360 - centerAngle

    // 4. Ajouter un léger décalage (jitter) pour un effet organique (±10° environ)
    const jitter = (Math.random() - 0.5) * (SEGMENT_ANGLE * 0.7)

    // 5. Calculer la rotation finale
    const targetRotation = rotation + 5 * 360 + toTop + jitter

    setRotation(targetRotation)
    // ----------------------------------

    // Wait for animation (3s)
    setTimeout(() => {
      setResult({ amount: data.reward, newBalance: data.new_balance })
      setSpinning(false)
      onWin(data.reward, data.new_balance)
    }, 3200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-5 relative"
        style={{ background: '#1a1a26', border: '1px solid #2a2a40' }}>
        {/* Close */}
        <button onClick={onClose}
          className="absolute top-4 right-4 text-cral-muted hover:text-cral-text transition-colors">
          <X size={20} />
        </button>

        {/* Header */}
        <div className="text-center">
          <div className="text-3xl mb-1">🎡</div>
          <h2 className="font-display text-2xl font-bold text-shimmer">Roue de Fortune</h2>
          <p className="text-cral-sub text-xs mt-1">Bonus quotidien · Reset à minuit (Montréal)</p>
        </div>

        {/* Already played */}
        {alreadyPlayed ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-cral-text font-medium">Déjà tournée aujourd&apos;hui!</div>
            <div className="text-gold-400 font-mono font-bold text-xl mt-1">+₡{formatCral(alreadyReward)}</div>
            <div className="text-cral-muted text-xs mt-2">Revenez demain pour un nouveau tour</div>
          </div>
        ) : (
          <>
            {/* Wheel */}
            <div className="relative flex items-center justify-center">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderTop: '20px solid #fbbf24',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                }} />
              </div>

              {/* Spinning wheel using CSS */}
              <div
                ref={wheelRef}
                style={{
                  width: 260,
                  height: 260,
                  borderRadius: '50%',
                  position: 'relative',
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 1.0)' : 'none',
                  border: '4px solid #fbbf24',
                  boxShadow: '0 0 20px rgba(251,191,36,0.3)',
                  overflow: 'hidden',
                }}>
                <svg width="260" height="260" viewBox="0 0 260 260">
                  {PRIZES.map((prize, i) => {
                    const startAngle = (i * SEGMENT_ANGLE - 90) * (Math.PI / 180)
                    const endAngle = ((i + 1) * SEGMENT_ANGLE - 90) * (Math.PI / 180)
                    const cx = 130, cy = 130, r = 128
                    const x1 = cx + r * Math.cos(startAngle)
                    const y1 = cy + r * Math.sin(startAngle)
                    const x2 = cx + r * Math.cos(endAngle)
                    const y2 = cy + r * Math.sin(endAngle)
                    const midAngle = ((i + 0.5) * SEGMENT_ANGLE - 90) * (Math.PI / 180)
                    const labelR = r * 0.65
                    const lx = cx + labelR * Math.cos(midAngle)
                    const ly = cy + labelR * Math.sin(midAngle)
                    const textAngle = (i + 0.5) * SEGMENT_ANGLE - 90

                    return (
                      <g key={i}>
                        <path
                          d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`}
                          fill={prize.bg}
                          stroke="#0a0a0f"
                          strokeWidth="1"
                        />
                        <text
                          x={lx} y={ly}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={prize.color}
                          fontSize="11"
                          fontWeight="bold"
                          fontFamily="monospace"
                          transform={`rotate(${textAngle + 90}, ${lx}, ${ly})`}
                        >
                          {prize.label}
                        </text>
                      </g>
                    )
                  })}
                  {/* Center circle */}
                  <circle cx="130" cy="130" r="18" fill="#0a0a0f" stroke="#fbbf24" strokeWidth="2" />
                  <text x="130" y="130" textAnchor="middle" dominantBaseline="central" fill="#fbbf24" fontSize="14">🎰</text>
                </svg>
              </div>
            </div>

            {/* Result */}
            {result ? (
              <div className="text-center space-y-2">
                <div className="text-4xl">🎉</div>
                <div className="font-display text-xl font-bold text-cral-text">Félicitations!</div>
                <div className="font-mono text-3xl font-bold text-gold-400">+₡{formatCral(result.amount)}</div>
                <div className="text-xs text-cral-muted">Ajouté à votre solde · Nouveau solde: ₡{formatCral(result.newBalance)}</div>
              </div>
            ) : (
              <div className="text-center">
                {error && <div className="text-red-400 text-xs mb-3">{error}</div>}
                <button
                  onClick={handleSpin}
                  disabled={spinning}
                  className="btn-gold px-10 py-3 text-base font-display font-bold disabled:opacity-60">
                  {spinning ? 'En rotation...' : '🎡 Tourner!'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
