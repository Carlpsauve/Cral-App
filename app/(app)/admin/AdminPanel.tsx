'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatCral, getInitials } from '@/lib/utils'
import { Profile } from '@/types'
import { Shield, Plus, Minus, UserCog, RefreshCw, Users, Coins, BarChart3 } from 'lucide-react'

export default function AdminPanel({ players: initialPlayers, currentUserId }: {
  players: Profile[]
  currentUserId: string
}) {
  const [players, setPlayers] = useState(initialPlayers)
  const [loading, setLoading] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const supabase = createClient()

  // Realtime: update player balances and roles live
  useEffect(() => {
    const channel = supabase
      .channel('admin-profiles')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles'
      }, payload => {
        setPlayers(prev =>
          prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new as Profile } : p)
        )
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'profiles'
      }, payload => {
        setPlayers(prev => [...prev, payload.new as Profile].sort((a, b) => a.username.localeCompare(b.username)))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleCredit(playerId: string) {
    const amt = parseFloat(amounts[playerId] || '0')
    if (isNaN(amt) || amt <= 0) return showToast('error', 'Montant invalide.')
    setLoading(`credit-${playerId}`)
    const player = players.find(p => p.id === playerId)!
    const newBalance = Math.round((player.balance + amt) * 100) / 100

    const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', playerId)
    if (error) { showToast('error', error.message); setLoading(null); return }

    await supabase.from('transactions').insert({
      user_id: playerId,
      amount: amt,
      type: 'admin_credit',
      description: `Crédit admin: +₡${formatCral(amt)}`,
    })
    setAmounts(prev => ({ ...prev, [playerId]: '' }))
    showToast('success', `₡${formatCral(amt)} crédités à ${player.username}`)
    setLoading(null)
  }

  async function handleDebit(playerId: string) {
    const amt = parseFloat(amounts[playerId] || '0')
    if (isNaN(amt) || amt <= 0) return showToast('error', 'Montant invalide.')
    const player = players.find(p => p.id === playerId)!
    const newBalance = Math.max(0, Math.round((player.balance - amt) * 100) / 100)
    const actualDebit = Math.round((player.balance - newBalance) * 100) / 100

    setLoading(`debit-${playerId}`)
    const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', playerId)
    if (error) { showToast('error', error.message); setLoading(null); return }

    await supabase.from('transactions').insert({
      user_id: playerId,
      amount: -actualDebit,
      type: 'admin_debit',
      description: `Débit admin: -₡${formatCral(actualDebit)}`,
    })
    setAmounts(prev => ({ ...prev, [playerId]: '' }))
    showToast('success', `₡${formatCral(actualDebit)} débités de ${player.username}`)
    setLoading(null)
  }

  async function handleReset(player: Profile) {
    if (!confirm(`Remettre ${player.username} à ₡100.00 ?`)) return
    setLoading(`reset-${player.id}`)
    const diff = Math.round((100 - player.balance) * 100) / 100
    const { error } = await supabase.from('profiles').update({ balance: 100 }).eq('id', player.id)
    if (error) { showToast('error', error.message); setLoading(null); return }

    await supabase.from('transactions').insert({
      user_id: player.id,
      amount: diff,
      type: diff >= 0 ? 'admin_credit' : 'admin_debit',
      description: `Reset admin à ₡100.00`,
    })
    showToast('success', `${player.username} remis à ₡100`)
    setLoading(null)
  }

  async function handleToggleRole(player: Profile) {
    if (player.id === currentUserId) return showToast('error', 'Vous ne pouvez pas changer votre propre rôle.')
    const newRole = player.role === 'super_admin' ? 'plebe' : player.role === 'homme_blanc_chauve' ? 'plebe' : 'super_admin'
    setLoading(`role-${player.id}`)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', player.id)
    if (error) { showToast('error', error.message); setLoading(null); return }
    showToast('success', `${player.username} → ${newRole === 'super_admin' ? 'Super Admin' : 'Plebe'}`)
    setLoading(null)
  }

  const totalCirculation = players.reduce((s, p) => s + p.balance, 0)
  const avgBalance = totalCirculation / (players.length || 1)
  const richest = [...players].sort((a, b) => b.balance - a.balance)[0]
  const poorest = [...players].sort((a, b) => a.balance - b.balance)[0]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-3">
          <Shield className="text-gold-400" size={28} />
          Panel Admin
        </h1>
        <p className="text-cral-sub text-sm mt-1">Gestion des joueurs · Mises à jour en temps réel</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`text-sm rounded-lg px-4 py-3 border transition-all ${
          toast.type === 'success'
            ? 'text-green-400 bg-green-400/10 border-green-400/20'
            : 'text-red-400 bg-red-400/10 border-red-400/20'
        }`}>
          {toast.type === 'success' ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <Users size={16} className="text-cral-sub mx-auto mb-2" />
          <div className="font-mono text-2xl font-bold text-cral-text">{players.length}</div>
          <div className="text-xs text-cral-sub mt-1">Joueurs</div>
        </div>
        <div className="card text-center">
          <Coins size={16} className="text-gold-400 mx-auto mb-2" />
          <div className="font-mono text-xl font-bold text-gold-400">₡{formatCral(totalCirculation)}</div>
          <div className="text-xs text-cral-sub mt-1">En circulation</div>
        </div>
        <div className="card text-center">
          <BarChart3 size={16} className="text-blue-400 mx-auto mb-2" />
          <div className="font-mono text-xl font-bold text-cral-text">₡{formatCral(avgBalance)}</div>
          <div className="text-xs text-cral-sub mt-1">Solde moyen</div>
        </div>
        <div className="card text-center">
          <div className="font-mono text-xl font-bold text-cral-text">
            ₡{formatCral(totalCirculation - players.length * 100)}
          </div>
          <div className="text-xs text-cral-sub mt-1">
            {totalCirculation >= players.length * 100 ? '↑ Inflation' : '↓ Déflation'}
          </div>
        </div>
      </div>

      {/* Top/bottom */}
      {players.length >= 2 && (
        <div className="grid grid-cols-2 gap-4">
          {richest && (
            <div className="card border-green-400/20">
              <div className="text-xs text-cral-sub mb-2">Plus riche 🏆</div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-cral-bg"
                  style={{ backgroundColor: richest.avatar_color }}>
                  {getInitials(richest.username)}
                </div>
                <div>
                  <div className="text-sm font-medium text-cral-text">{richest.username}</div>
                  <div className="text-xs font-mono text-green-400">₡{formatCral(richest.balance)}</div>
                </div>
              </div>
            </div>
          )}
          {poorest && poorest.id !== richest?.id && (
            <div className="card border-red-400/20">
              <div className="text-xs text-cral-sub mb-2">Plus pauvre 💸</div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-cral-bg"
                  style={{ backgroundColor: poorest.avatar_color }}>
                  {getInitials(poorest.username)}
                </div>
                <div>
                  <div className="text-sm font-medium text-cral-text">{poorest.username}</div>
                  <div className="text-xs font-mono text-red-400">₡{formatCral(poorest.balance)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Players list */}
      <div>
        <h2 className="font-display text-lg font-bold text-cral-text mb-4">Gestion des joueurs</h2>
        <div className="space-y-3">
          {players.map(player => {
            const isMe = player.id === currentUserId
            const isLoadingAny = loading?.includes(player.id)
            return (
              <div key={player.id} className={`card space-y-4 transition-all ${isMe ? 'border-gold-500/30' : ''}`}>
                {/* Player info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-cral-bg flex-shrink-0"
                    style={{ backgroundColor: player.avatar_color }}>
                    {getInitials(player.username)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-cral-text">{player.username}</span>
                      {isMe && <span className="text-xs text-gold-500">vous</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        player.role === 'super_admin'
                          ? 'bg-purple-400/10 text-purple-400'
                          : player.role === 'homme_blanc_chauve'
                          ? 'bg-purple-400/5 text-purple-300'
                          : 'bg-cral-surface text-cral-muted'
                      }`}>
                        {player.role === 'super_admin' ? '⚡ Super Admin' : player.role === 'homme_blanc_chauve' ? '🦲 Homme Blanc Chauve' : 'Plebe'}
                      </span>
                    </div>
                    <div className="text-sm font-mono text-gold-400 mt-0.5">₡{formatCral(player.balance)}</div>
                  </div>
                  {/* Balance bar */}
                  <div className="hidden sm:block w-24">
                    <div className="h-1.5 rounded-full bg-cral-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (player.balance / Math.max(...players.map(p => p.balance), 1)) * 100)}%`,
                          background: player.balance >= 100 ? '#34d399' : '#f87171'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex gap-2 flex-wrap items-center">
                  <div className="relative flex-1 min-w-[120px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-400 font-mono text-sm">₡</span>
                    <input
                      type="number"
                      value={amounts[player.id] ?? ''}
                      onChange={e => setAmounts(prev => ({ ...prev, [player.id]: e.target.value }))}
                      className="input-field pl-7 py-2 text-sm"
                      placeholder="Montant"
                      min="0.01"
                      step="0.01"
                      disabled={!!isLoadingAny}
                    />
                  </div>

                  <button
                    onClick={() => handleCredit(player.id)}
                    disabled={!!isLoadingAny || !amounts[player.id]}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors text-sm font-medium disabled:opacity-40 flex-shrink-0"
                  >
                    {loading === `credit-${player.id}`
                      ? <span className="w-3 h-3 border border-green-400/40 border-t-green-400 rounded-full animate-spin" />
                      : <Plus size={14} />}
                    Créditer
                  </button>

                  <button
                    onClick={() => handleDebit(player.id)}
                    disabled={!!isLoadingAny || !amounts[player.id]}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors text-sm font-medium disabled:opacity-40 flex-shrink-0"
                  >
                    {loading === `debit-${player.id}`
                      ? <span className="w-3 h-3 border border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                      : <Minus size={14} />}
                    Débiter
                  </button>

                  <button
                    onClick={() => handleReset(player)}
                    disabled={!!isLoadingAny}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cral-surface text-cral-sub hover:text-cral-text transition-colors text-sm disabled:opacity-40 flex-shrink-0"
                    title="Remettre à ₡100"
                  >
                    {loading === `reset-${player.id}`
                      ? <span className="w-3 h-3 border border-cral-muted border-t-cral-sub rounded-full animate-spin" />
                      : <RefreshCw size={14} />}
                    ₡100
                  </button>

                  {!isMe && (
                    <button
                      onClick={() => handleToggleRole(player)}
                      disabled={!!isLoadingAny}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-400/10 text-purple-400 hover:bg-purple-400/20 transition-colors text-sm disabled:opacity-40 flex-shrink-0"
                    >
                      {loading === `role-${player.id}`
                        ? <span className="w-3 h-3 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
                        : <UserCog size={14} />}
                      {player.role === 'super_admin' ? '→ Plebe' : player.role === 'homme_blanc_chauve' ? '→ Plebe' : '→ Admin'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
