import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { SPORTS } from '@/lib/sports'

export const dynamic = 'force-dynamic'

const ODDS_API_KEY = process.env.ODDS_API_KEY ?? ''

// Called by Vercel Cron every hour: /api/sports/cron
export async function GET(request: NextRequest) {
  // Verify cron secret
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? 'dev'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Get matches that have started and aren't resolved yet
  const now = new Date().toISOString()
  const { data: pendingMatches } = await supabase
    .from('sport_matches')
    .select('*')
    .eq('status', 'upcoming')
    .lt('commence_time', now)
    .eq('result_checked', false)

  if (!pendingMatches?.length) {
    return NextResponse.json({ message: 'No pending matches', resolved: 0 })
  }

  let totalResolved = 0

  for (const match of pendingMatches) {
    try {
      if (!ODDS_API_KEY) {
        // No API key — mark as needing manual check
        continue
      }

      // Fetch scores from The Odds API
      const sport = SPORTS.find(s => s.key === match.sport_key)
      if (!sport) continue

      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${match.sport_key}/scores/?` +
        `apiKey=${ODDS_API_KEY}&daysFrom=3&eventIds=${match.id}`,
      )
      if (!res.ok) continue

      const scores: any[] = await res.json()
      const score = scores.find((s: any) => s.id === match.id)
      if (!score) continue

      if (!score.completed) {
        // Match still in progress — mark as live
        await supabase.from('sport_matches').update({ status: 'live' }).eq('id', match.id)
        continue
      }

      // Match finished — determine winner
      const homeScore = score.scores?.find((s: any) => s.name === match.home_team)?.score
      const awayScore = score.scores?.find((s: any) => s.name === match.away_team)?.score

      if (homeScore == null || awayScore == null) continue

      const h = parseInt(homeScore)
      const a = parseInt(awayScore)
      let winner: string

      if (h > a) winner = 'home'
      else if (a > h) winner = 'away'
      else winner = 'draw'

      // Update match
      await supabase.from('sport_matches').update({
        status: 'finished',
        home_score: h,
        away_score: a,
        winner,
      }).eq('id', match.id)

      // Resolve all bets for this match
      const { data: resolved } = await supabase
        .rpc('resolve_sport_bets', { p_match_id: match.id })

      totalResolved += resolved ?? 0

    } catch (err) {
      console.error(`Error resolving match ${match.id}:`, err)
    }
  }

  return NextResponse.json({ message: 'Done', resolved: totalResolved })
}
