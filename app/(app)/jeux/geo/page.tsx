'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { GEO_QUESTIONS, getRandomQuestion, shuffleOptions, CATEGORY_LABELS, DIFFICULTY_LABELS, type GeoQuestion } from '@/lib/geo'
import { formatCral } from '@/lib/utils'
import { ArrowLeft, Globe, Star, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

type Phase = 'question' | 'answered'

export default function GeoPage() {
  const [question, setQuestion] = useState<GeoQuestion | null>(null)
  const [options, setOptions] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('question')
  const [selected, setSelected] = useState<string>('')
  const [correct, setCorrect] = useState(false)
  const [reward, setReward] = useState(0)
  const [balance, setBalance] = useState(0)
  const [clueIndex, setClueIndex] = useState(0)
  const [playedToday, setPlayedToday] = useState(0)
  const [wonToday, setWonToday] = useState(0)
  const [loading, setLoading] = useState(false)
  const [streak, setStreak] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
      if (profile) setBalance(profile.balance)

      const today = new Date().toISOString().split('T')[0]
      const { data: plays } = await supabase
        .from('geo_plays').select('correct, reward')
        .eq('user_id', user.id)
        .gte('played_at', `${today}T00:00:00`)
      setPlayedToday(plays?.length ?? 0)
      setWonToday(plays?.reduce((s: number, p: any) => s + p.reward, 0) ?? 0)

      // Compute streak
      const lastPlays = plays?.slice(-10) ?? []
      let s = 0
      for (let i = lastPlays.length - 1; i >= 0; i--) {
        if (lastPlays[i].correct) s++
        else break
      }
      setStreak(s)
    }
    load()
    nextQuestion()
  }, [])

  function nextQuestion() {
    const q = getRandomQuestion()
    setQuestion(q)
    setOptions(shuffleOptions(q))
    setPhase('question')
    setSelected('')
    setClueIndex(0)
  }

  async function handleAnswer(answer: string) {
    if (phase !== 'question' || !question) return
    setSelected(answer)
    setLoading(true)

    const res = await fetch('/api/geo/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: question.id, answer }),
    })
    const data = await res.json()
    setCorrect(data.correct)
    setReward(data.reward)
    if (data.new_balance) setBalance(data.new_balance)
    setPlayedToday(p => p + 1)
    if (data.correct) {
      setWonToday(w => w + data.reward)
      setStreak(s => s + 1)
    } else {
      setStreak(0)
    }
    setPhase('answered')
    setLoading(false)
  }

  function revealNextClue() {
    if (question && clueIndex < question.clues.length - 1) {
      setClueIndex(i => i + 1)
    }
  }

  const difficultyColors: Record<number, string> = {
    1: 'text-green-400 bg-green-400/10',
    2: 'text-yellow-400 bg-yellow-400/10',
    3: 'text-red-400 bg-red-400/10',
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/jeux" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-cral-card transition-colors text-cral-sub">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-2">
            <Globe className="text-blue-400" size={28} />
            GeoGuessr
          </h1>
          <p className="text-cral-sub text-sm">Gratuit · Illimité · Devinez villes, pays et monuments</p>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-lg font-bold text-gold-400">₡{formatCral(balance)}</div>
          <div className="text-xs text-cral-muted">{playedToday} questions · +₡{formatCral(wonToday)}</div>
        </div>
      </div>

      {/* Streak */}
      {streak >= 2 && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)'
        }}>
          <span className="text-xl">🔥</span>
          <span className="text-sm font-medium text-gold-400">Série de {streak} bonnes réponses!</span>
        </div>
      )}

      {/* Question card */}
      {question && (
        <div className="card space-y-5">
          {/* Meta */}
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-blue-400/10 text-blue-400">
              {CATEGORY_LABELS[question.category]}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${difficultyColors[question.difficulty]}`}>
              {DIFFICULTY_LABELS[question.difficulty]}
            </span>
            <span className="text-xs text-gold-400 ml-auto font-mono">
              +₡{question.baseReward} si correct
            </span>
          </div>

          {/* Clues */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-cral-sub uppercase tracking-wider">Indices</div>
            {question.clues.slice(0, clueIndex + 1).map((clue, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-lg px-4 py-2.5 ${
                i === clueIndex ? 'bg-blue-400/10 border border-blue-400/20' : 'bg-cral-surface'
              }`}>
                <span className="text-blue-400 font-mono text-xs mt-0.5 flex-shrink-0">{i + 1}</span>
                <span className="text-sm text-cral-text">{clue}</span>
              </div>
            ))}
            {phase === 'question' && clueIndex < question.clues.length - 1 && (
              <button onClick={revealNextClue}
                className="w-full text-xs text-cral-muted hover:text-cral-sub transition-colors py-2 border border-dashed border-cral-border rounded-lg">
                Révéler un indice supplémentaire →
              </button>
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-2">
            {options.map(opt => {
              const isSelected = selected === opt
              const isCorrectAnswer = phase === 'answered' && opt === question.answer
              const isWrongSelected = phase === 'answered' && isSelected && !correct
              return (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  disabled={phase === 'answered' || loading}
                  className={`relative px-4 py-3 rounded-xl text-sm font-medium text-left transition-all border ${
                    isCorrectAnswer
                      ? 'bg-green-400/20 border-green-400/50 text-green-300'
                      : isWrongSelected
                      ? 'bg-red-400/20 border-red-400/50 text-red-300'
                      : isSelected && phase === 'question'
                      ? 'bg-blue-400/15 border-blue-400/40 text-blue-300'
                      : phase === 'question'
                      ? 'border-cral-border hover:border-gold-500/40 hover:bg-cral-card text-cral-text'
                      : 'border-cral-border text-cral-muted opacity-60'
                  } disabled:cursor-not-allowed`}
                >
                  <span>{opt}</span>
                  {isCorrectAnswer && <CheckCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />}
                  {isWrongSelected && <XCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400" />}
                </button>
              )
            })}
          </div>

          {/* Result */}
          {phase === 'answered' && (
            <div className={`rounded-xl p-4 text-center ${correct ? 'bg-green-400/10 border border-green-400/25' : 'bg-red-400/10 border border-red-400/20'}`}>
              <div className="text-2xl mb-1">{correct ? '🎉' : '❌'}</div>
              <div className={`font-display text-lg font-bold ${correct ? 'text-green-400' : 'text-red-400'}`}>
                {correct ? 'Bonne réponse!' : `Raté — c'était ${question.answer}`}
              </div>
              {correct && reward > 0 && (
                <div className="font-mono text-xl font-bold text-gold-400 mt-1">+₡{formatCral(reward)}</div>
              )}
              <button onClick={nextQuestion}
                className="mt-4 btn-gold py-2 px-8 text-sm">
                Question suivante →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-4">
          <div className="font-mono text-xl font-bold text-cral-text">{playedToday}</div>
          <div className="text-xs text-cral-sub mt-1">Questions aujourd&apos;hui</div>
        </div>
        <div className="card text-center py-4">
          <div className="font-mono text-xl font-bold text-green-400">₡{formatCral(wonToday)}</div>
          <div className="text-xs text-cral-sub mt-1">Gagné aujourd&apos;hui</div>
        </div>
        <div className="card text-center py-4">
          <div className="font-mono text-xl font-bold text-gold-400 flex items-center justify-center gap-1">
            {streak > 0 && <span>🔥</span>}{streak}
          </div>
          <div className="text-xs text-cral-sub mt-1">Série actuelle</div>
        </div>
      </div>
    </div>
  )
}
