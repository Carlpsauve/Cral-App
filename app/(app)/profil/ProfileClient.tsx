'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatCral, getInitials } from '@/lib/utils'
import { Profile } from '@/types'
import { User, TrendingUp, TrendingDown, Gamepad2, Swords, Edit2, Check, X } from 'lucide-react'

const AVATAR_COLORS = [
  '#fbbf24', '#f87171', '#34d399', '#60a5fa',
  '#a78bfa', '#fb7185', '#38bdf8', '#4ade80',
  '#f97316', '#e879f9', '#2dd4bf', '#facc15',
]

interface Props {
  profile: Profile
  stats: {
    totalWon: number
    totalLost: number
    netPnl: number
    dailyPlays: number
    betWins: number
    totalBets: number
  }
}

export default function ProfileClient({ profile: initialProfile, stats }: Props) {
  const [profile, setProfile] = useState(initialProfile)
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState(initialProfile.username)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  async function handleSaveUsername() {
    if (newUsername.length < 3) return setError('Min. 3 caractères')
    setSaving(true)
    setError('')
    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', profile.id)
    if (error) {
      setError(error.message.includes('unique') ? 'Ce nom est déjà pris.' : error.message)
    } else {
      setProfile(prev => ({ ...prev, username: newUsername }))
      setSuccess('Nom mis à jour!')
      setEditingUsername(false)
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  async function handleColorChange(color: string) {
    setProfile(prev => ({ ...prev, avatar_color: color }))
    await supabase.from('profiles').update({ avatar_color: color }).eq('id', profile.id)
    setSuccess('Couleur mise à jour!')
    setTimeout(() => setSuccess(''), 2000)
  }

  const winRate = stats.totalBets > 0 ? Math.round((stats.betWins / stats.totalBets) * 100) : 0

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-3">
          <User className="text-gold-400" size={28} />
          Mon profil
        </h1>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-3">✓ {success}</div>
      )}

      {/* Avatar + identity */}
      <div className="card space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-cral-bg flex-shrink-0 transition-colors duration-200"
            style={{ backgroundColor: profile.avatar_color }}
          >
            {getInitials(profile.username)}
          </div>
          <div className="flex-1 min-w-0">
            {editingUsername ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="input-field py-2 text-base"
                  maxLength={30}
                  autoFocus
                />
                <button onClick={handleSaveUsername} disabled={saving}
                  className="w-9 h-9 rounded-lg bg-green-400/20 text-green-400 hover:bg-green-400/30 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Check size={16} />
                </button>
                <button onClick={() => { setEditingUsername(false); setNewUsername(profile.username) }}
                  className="w-9 h-9 rounded-lg bg-cral-surface text-cral-sub hover:text-cral-text flex items-center justify-center flex-shrink-0 transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xl font-display font-bold text-cral-text">{profile.username}</span>
                <button onClick={() => setEditingUsername(true)}
                  className="text-cral-muted hover:text-cral-sub transition-colors">
                  <Edit2 size={14} />
                </button>
              </div>
            )}
            <div className="text-cral-sub text-sm mt-1">{profile.email}</div>
            <div className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${
              profile.role === 'super_admin'
                ? 'bg-purple-400/10 text-purple-400'
                : 'bg-cral-surface text-cral-sub'
            }`}>
              {profile.role === 'super_admin' ? '⚡ Super Admin' : 'Plebe'}
            </div>
          </div>
        </div>

        {/* Color picker */}
        <div>
          <div className="text-xs font-medium text-cral-sub mb-3">Couleur de l&apos;avatar</div>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map(color => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                className="w-8 h-8 rounded-lg transition-all duration-150 hover:scale-110"
                style={{
                  backgroundColor: color,
                  outline: profile.avatar_color === color ? `2px solid ${color}` : 'none',
                  outlineOffset: '2px',
                  boxShadow: profile.avatar_color === color ? `0 0 12px ${color}60` : 'none',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Balance */}
      <div className="rounded-xl p-6 glow-gold" style={{
        background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))',
        border: '1px solid rgba(251,191,36,0.3)'
      }}>
        <div className="text-xs text-cral-sub uppercase tracking-widest mb-2">Solde actuel</div>
        <div className="font-display text-5xl font-bold text-shimmer">₡{formatCral(profile.balance)}</div>
        <div className="text-xs text-cral-muted mt-2 font-mono">
          {profile.balance >= 100
            ? `+₡${formatCral(profile.balance - 100)} depuis le début`
            : `-₡${formatCral(100 - profile.balance)} depuis le début`}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card space-y-4">
          <div className="text-xs font-semibold text-cral-sub uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={12} className="text-green-400" /> Gains
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-green-400">₡{formatCral(stats.totalWon)}</div>
            <div className="text-xs text-cral-muted mt-0.5">Total reçu</div>
          </div>
        </div>
        <div className="card space-y-4">
          <div className="text-xs font-semibold text-cral-sub uppercase tracking-wider flex items-center gap-2">
            <TrendingDown size={12} className="text-red-400" /> Pertes
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-red-400">₡{formatCral(stats.totalLost)}</div>
            <div className="text-xs text-cral-muted mt-0.5">Total perdu</div>
          </div>
        </div>
        <div className="card space-y-4">
          <div className="text-xs font-semibold text-cral-sub uppercase tracking-wider flex items-center gap-2">
            <Swords size={12} className="text-gold-400" /> Gajures
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-cral-text">{stats.betWins}/{stats.totalBets}</div>
            <div className="text-xs text-cral-muted mt-0.5">Victoires · {winRate}% de win rate</div>
          </div>
        </div>
        <div className="card space-y-4">
          <div className="text-xs font-semibold text-cral-sub uppercase tracking-wider flex items-center gap-2">
            <Gamepad2 size={12} className="text-blue-400" /> Daily
          </div>
          <div>
            <div className="font-mono text-xl font-bold text-cral-text">{stats.dailyPlays}</div>
            <div className="text-xs text-cral-muted mt-0.5">Parties jouées</div>
          </div>
        </div>
      </div>

      {/* Net P&L */}
      <div className={`card text-center ${stats.netPnl >= 0 ? 'border-green-400/20' : 'border-red-400/20'}`}>
        <div className="text-xs text-cral-sub mb-2">Bilan net (hors bonus inscription)</div>
        <div className={`font-mono text-3xl font-bold ${stats.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {stats.netPnl >= 0 ? '+' : ''}₡{formatCral(stats.netPnl)}
        </div>
      </div>
    </div>
  )
}
