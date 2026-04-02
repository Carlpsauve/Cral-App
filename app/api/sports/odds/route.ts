import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { SPORTS, extractOdds, type OddsEvent } from '@/lib/sports'

export const dynamic = 'force-dynamic'

const ODDS_API_KEY = process.env.ODDS_API_KEY ?? ''
const CACHE_HOURS = 12 // refresh every 12 hours — ~60 req/month for NHL only

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'

  // Check if we have recent data in cache
  const cacheThreshold = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from('sport_matches')
    .select('odds_updated')
    .eq('status', 'upcoming')
    .order('odds_updated', { ascending: false })
    .limit(1)

  const lastUpdate = cached?.[0]?.odds_updated
  const cacheValid = !forceRefresh && lastUpdate && lastUpdate > cacheThreshold

  if (cacheValid) {
    // Return cached matches
    const { data: matches } = await supabase
      .from('sport_matches')
      .select('*')
      .eq('status', 'upcoming')
      .gte('commence_time', new Date().toISOString())
      .order('commence_time', { ascending: true })
      .limit(50)

    return NextResponse.json({ matches: matches ?? [], cached: true, last_update: lastUpdate })
  }

  if (!ODDS_API_KEY) {
    // Return cached data even if stale when no API key
    const { data: matches } = await supabase
      .from('sport_matches')
      .select('*')
      .eq('status', 'upcoming')
      .gte('commence_time', new Date().toISOString())
      .order('commence_time', { ascending: true })
      .limit(50)
    return NextResponse.json({ matches: matches ?? [], cached: true, no_key: true })
  }

  // Fetch fresh from The Odds API
  const allMatches: any[] = []
  const now = new Date().toISOString()

  // Fetch all sports (batched to save quota — fetch 4 sports at once)
  const sportKeys = SPORTS.map(s => s.key)

  try {
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${ODDS_API_KEY}`,
    )
    // Check available sports first (1 request)
  } catch {}

  for (const sport of SPORTS) {
    try {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sport.key}/odds/?` +
        `apiKey=${ODDS_API_KEY}&regions=us,eu&markets=h2h&oddsFormat=decimal&dateFormat=iso`,
        { next: { revalidate: 0 } }
      )
      if (!res.ok) continue
      const events: OddsEvent[] = await res.json()

      for (const event of events.slice(0, 10)) { // max 10 per sport
        const odds = extractOdds(event)
        if (!odds) continue

        await supabase.from('sport_matches').upsert({
          id: event.id,
          sport_key: sport.key,
          sport_label: sport.label,
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          status: 'upcoming',
          odds_home: odds.odds_home,
          odds_away: odds.odds_away,
          odds_draw: odds.odds_draw,
          odds_updated: now,
        }, { onConflict: 'id' })

        allMatches.push({ ...odds, status: 'upcoming', odds_updated: now })
      }
    } catch (err) {
      console.error(`Failed to fetch ${sport.key}:`, err)
    }
  }

  // Mark old upcoming matches as stale if not in new fetch
  // (don't delete — they might still have bets on them)

  const { data: matches } = await supabase
    .from('sport_matches')
    .select('*')
    .eq('status', 'upcoming')
    .gte('commence_time', new Date().toISOString())
    .order('commence_time', { ascending: true })
    .limit(50)

  return NextResponse.json({ matches: matches ?? [], cached: false, last_update: now })
}
