'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { getMontrealDateString } from '@/lib/slots'
import FortuneWheel from '@/components/ui/FortuneWheel'
import { formatCral } from '@/lib/utils'

export default function DashboardWheelTrigger() {
  const [showWheel, setShowWheel] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [winBanner, setWinBanner] = useState<{ amount: number } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const today = getMontrealDateString()
      const { data: existing } = await supabase
        .from('daily_wheel')
        .select('id')
        .eq('user_id', user.id)
        .eq('played_date', today)
        .maybeSingle()

      // Show wheel if not played today
      if (!existing) {
        // Small delay so dashboard renders first
        setTimeout(() => setShowWheel(true), 800)
      }
    }
    check()
  }, [])

  function handleWin(amount: number, newBalance: number) {
    setBalance(newBalance)
    setWinBanner({ amount })
    setTimeout(() => setWinBanner(null), 6000)
  }

  function handleClose() {
    setShowWheel(false)
  }

  return (
    <>
      {/* Win banner after closing wheel */}
      {winBanner && !showWheel && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
          <div className="rounded-2xl px-6 py-3 flex items-center gap-3 shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #78350f, #92400e)', border: '1px solid #fbbf24' }}>
            <span className="text-2xl">🎡</span>
            <div>
              <div className="text-xs text-gold-300">Roue de fortune</div>
              <div className="font-mono font-bold text-gold-400 text-lg">+₡{formatCral(winBanner.amount)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Wheel popup */}
      {showWheel && (
        <FortuneWheel
          onClose={handleClose}
          onWin={handleWin}
        />
      )}
    </>
  )
}
