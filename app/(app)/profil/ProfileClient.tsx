'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { formatCral, getInitials } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { Profile } from '@/types'
import { TITLES_CONFIG, DEFAULT_TITLE_CONFIG } from '@/config/titles'
import { User, TrendingUp, TrendingDown, Gamepad2, Swords, Edit2, Check, X, Coffee, Award, Palette } from 'lucide-react'
const AVATAR_COLORS = [
  '#fbbf24', '#f87171', '#34d399', '#60a5fa',
  '#a78bfa', '#fb7185', '#38bdf8', '#4ade80',
  '#f97316', '#e879f9', '#2dd4bf', '#facc15',
]

interface Props {
  profile: Profile & { unlocked_titles?: string[], active_title?: string } // Ajout des types
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

  // On détermine le config du titre actif (ou fallback sur son ancien rôle si la DB n'est pas à jour)
  const activeTitleKey = profile.active_title || (TITLES_CONFIG[profile.role] ? profile.role : null)
  const activeConfig = activeTitleKey ? TITLES_CONFIG[activeTitleKey] : DEFAULT_TITLE_CONFIG

  // Liste de secours si le backend ne renvoie pas encore de tableau (le joueur a au moins son vieux rôle)
  const unlockedTitles = profile.unlocked_titles || (TITLES_CONFIG[profile.role] ? [profile.role] : [])

  async function handleSaveUsername() {
    if (newUsername.length < 3) return setError('Min. 3 caractères')
    setSaving(true)
    setError('')
    const { error } = await supabase.from('profiles').update({ username: newUsername }).eq('id', profile.id)
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

  // ✨ NOUVEAU: Changer de titre ✨
  async function handleTitleChange(titleKey: string) {
    setProfile(prev => ({ ...prev, active_title: titleKey }))
    await supabase.from('profiles').update({ active_title: titleKey }).eq('id', profile.id)
    setSuccess('Titre équipé !')
    setTimeout(() => setSuccess(''), 2000)
  }

  const winRate = stats.totalBets > 0 ? Math.round((stats.betWins / stats.totalBets) * 100) : 0

  return (
    <div className="max-w-2xl space-y-6 pb-20">
      <div>
        <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-3">
          <User className="text-gold-400" size={28} />
          Mon profil
        </h1>
      </div>

      {error && <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-3">✓ {success}</div>}

      {/* Avatar + identity */}
      <div className="card space-y-8">
        <div className="flex items-center gap-5">
          
          {/* ✨ Le Ring Dynamique ✨ */}
          <div className={activeConfig.ringClass}>
            <div className={activeTitleKey ? 'bg-[#12121a] rounded-[14px] p-1' : ''}>
              <Avatar username={profile.username} avatarColor={profile.avatar_color} avatarSvg={profile.avatar_svg} size={80} className="rounded-2xl" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {editingUsername ? (
              <div className="flex items-center gap-2">
                <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="input-field py-2 text-base" maxLength={30} autoFocus />
                <button onClick={handleSaveUsername} disabled={saving} className="w-9 h-9 rounded-lg bg-green-400/20 text-green-400 hover:bg-green-400/30 flex items-center justify-center flex-shrink-0 transition-colors"><Check size={16} /></button>
                <button onClick={() => { setEditingUsername(false); setNewUsername(profile.username) }} className="w-9 h-9 rounded-lg bg-cral-surface text-cral-sub hover:text-cral-text flex items-center justify-center flex-shrink-0 transition-colors"><X size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* ✨ Le Texte Dynamique ✨ */}
                <span className={`text-xl font-display font-bold ${activeConfig.textClass}`}>
                  {profile.username}
                </span>
                <button onClick={() => setEditingUsername(true)} className="text-cral-muted hover:text-cral-sub transition-colors"><Edit2 size={14} /></button>
              </div>
            )}
            <div className="text-cral-sub text-sm mt-1">{profile.email}</div>
            
            {/* ✨ Le Tag Dynamique (Titre) ✨ */}
            <div className={`text-xs mt-2 px-3 py-1 rounded-full inline-block ${activeConfig.tagClass}`}>
               {profile.role === 'super_admin' ? '⚡ Super Admin' : (activeTitleKey ? TITLES_CONFIG[activeTitleKey].label : 'Plèbe')}
            </div>
          </div>
        </div>

        {/* 🎨 Zone de personnalisation (Couleurs et Titres) */}
        <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
          {/* Color picker */}
          <div>
            <div className="text-xs font-medium text-cral-sub mb-3 flex items-center gap-2">
              <Palette size={14} /> Couleur de l&apos;avatar
            </div>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color} onClick={() => handleColorChange(color)}
                  className="w-8 h-8 rounded-lg transition-all duration-150 hover:scale-110"
                  style={{ backgroundColor: color, outline: profile.avatar_color === color ? `2px solid ${color}` : 'none', outlineOffset: '2px', boxShadow: profile.avatar_color === color ? `0 0 12px ${color}60` : 'none' }}
                />
              ))}
            </div>
          </div>

          {/* ✨ Sélection du Titre Actif ✨ */}
          <div>
             <div className="text-xs font-medium text-cral-sub mb-3 flex items-center gap-2">
              <Award size={14} /> Titre équipé
            </div>
            {unlockedTitles.length > 0 ? (
              <select 
                value={activeTitleKey || ''} 
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none"
              >
                <option value="">Aucun titre</option>
                {unlockedTitles.map(key => (
                  TITLES_CONFIG[key] && <option key={key} value={key}>{TITLES_CONFIG[key].label}</option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-gray-500 italic bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                Tu n'as débloqué aucun titre pour le moment. Collectionne des cartes pour en obtenir !
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Balance */}
      <div className="rounded-xl p-6 glow-gold" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))', border: '1px solid rgba(251,191,36,0.3)' }}>
        <div className="text-xs text-cral-sub uppercase tracking-widest mb-2">Solde actuel</div>
        <div className="font-display text-5xl font-bold text-shimmer">₡{formatCral(profile.balance)}</div>
        <div className="text-xs text-cral-muted mt-2 font-mono">{profile.balance >= 100 ? `+₡${formatCral(profile.balance - 100)} depuis le début` : `-₡${formatCral(100 - profile.balance)} depuis le début`}</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* ... (Je n'ai pas touché à la section des stats, tu peux la laisser telle quelle) ... */}
      </div>

      {/* Net P&L */}
      <div className={`card text-center ${stats.netPnl >= 0 ? 'border-green-400/20' : 'border-red-400/20'}`}>
        <div className="text-xs text-cral-sub mb-2">Bilan net (hors bonus inscription)</div>
        <div className={`font-mono text-3xl font-bold ${stats.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {stats.netPnl >= 0 ? '+' : ''}₡{formatCral(stats.netPnl)}
        </div>
      </div>

      {/* BOUTON KO-FI */}
      <a href="https://ko-fi.com/cralou" target="_blank" rel="noopener noreferrer" className="group mt-8 flex items-center justify-center gap-3 w-full p-4 rounded-2xl text-white font-bold text-lg bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-xl shadow-purple-500/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-purple-500/40">
        <Coffee size={24} className="group-hover:rotate-12 transition-transform" />
        <span>Soutenir le projet sur Ko-fi</span>
      </a>

    </div>
  )
}