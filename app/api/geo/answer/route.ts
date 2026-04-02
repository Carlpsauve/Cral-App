import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { GEO_QUESTIONS } from '@/lib/geo'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { question_id, answer } = await request.json()

  const question = GEO_QUESTIONS.find(q => q.id === question_id)
  if (!question) return NextResponse.json({ error: 'Question introuvable' }, { status: 404 })

  const correct = answer === question.answer
  const reward = correct ? question.baseReward : 0

  const { data: profile } = await supabase
    .from('profiles').select('balance').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const newBalance = Math.round((profile.balance + reward) * 100) / 100

  // Save play
  await supabase.from('geo_plays').insert({
    user_id: user.id,
    question_id,
    answer,
    correct,
    score: correct ? question.difficulty * 100 : 0,
    reward,
  })

  // Update balance if won
  if (reward > 0) {
    await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)
    await supabase.from('transactions').insert({
      user_id: user.id,
      amount: reward,
      type: 'daily_free_win',
      description: `GeoGuessr — Bonne réponse: ${question.answer} (+₡${reward})`,
    })
  }

  return NextResponse.json({
    correct,
    correct_answer: question.answer,
    reward,
    new_balance: newBalance,
  })
}
