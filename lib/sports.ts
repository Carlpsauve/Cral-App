// The Odds API - https://the-odds-api.com
// Free tier: 500 requests/month

export const SPORTS = [
  { key: 'icehockey_nhl', label: 'NHL', flag: '🏒', region: 'us' },
]

export interface OddsEvent {
  id: string
  sport_key: string
  sport_title: string
  home_team: string
  away_team: string
  commence_time: string
  bookmakers: Array<{
    key: string
    markets: Array<{
      key: string
      outcomes: Array<{ name: string; price: number }>
    }>
  }>
}

export interface MatchOdds {
  id: string
  sport_key: string
  sport_label: string
  home_team: string
  away_team: string
  commence_time: string
  odds_home: number   // decimal
  odds_away: number
  odds_draw: number | null
}

// Convert American odds to decimal
export function americanToDecimal(american: number): number {
  if (american > 0) return Math.round((american / 100 + 1) * 100) / 100
  return Math.round((100 / Math.abs(american) + 1) * 100) / 100
}

// Extract best available odds from bookmakers (use DraftKings or first available)
export function extractOdds(event: OddsEvent): MatchOdds | null {
  const sport = SPORTS.find(s => s.key === event.sport_key)

  // Try DraftKings first, then FanDuel, then any
  const preferred = ['draftkings', 'fanduel', 'betmgm', 'bovada']
  let bookmaker = event.bookmakers.find(b => preferred.includes(b.key))
  if (!bookmaker) bookmaker = event.bookmakers[0]
  if (!bookmaker) return null

  const market = bookmaker.markets.find(m => m.key === 'h2h')
  if (!market) return null

  const home = market.outcomes.find(o => o.name === event.home_team)
  const away = market.outcomes.find(o => o.name === event.away_team)
  const draw = market.outcomes.find(o => o.name === 'Draw')

  if (!home || !away) return null

  return {
    id: event.id,
    sport_key: event.sport_key,
    sport_label: sport?.label ?? event.sport_title,
    home_team: event.home_team,
    away_team: event.away_team,
    commence_time: event.commence_time,
    odds_home: home.price,
    odds_away: away.price,
    odds_draw: draw?.price ?? null,
  }
}

export function getSportInfo(key: string) {
  return SPORTS.find(s => s.key === key) ?? { key, label: key, flag: '🏟️', region: 'us' }
}

export function formatOdds(decimal: number): string {
  // Show as decimal odds e.g. 2.10
  return decimal.toFixed(2)
}

export function formatAmericanOdds(decimal: number): string {
  // Convert back to American for display e.g. +110, -150
  if (decimal >= 2) {
    const american = Math.round((decimal - 1) * 100)
    return `+${american}`
  } else {
    const american = Math.round(-100 / (decimal - 1))
    return `${american}`
  }
}

export function potentialWin(amount: number, odds: number): number {
  return Math.round(amount * odds * 100) / 100
}

// Status display
export function betStatusColor(status: string): string {
  switch (status) {
    case 'won': return 'text-green-400 bg-green-400/10'
    case 'lost': return 'text-red-400 bg-red-400/10'
    case 'cancelled':
    case 'push': return 'text-cral-muted bg-cral-surface'
    default: return 'text-yellow-400 bg-yellow-400/10'
  }
}

export function betStatusLabel(status: string): string {
  switch (status) {
    case 'won': return '✅ Gagné'
    case 'lost': return '❌ Perdu'
    case 'cancelled': return '↩️ Annulé'
    case 'push': return '🤝 Remboursé'
    default: return '⏳ En attente'
  }
}
