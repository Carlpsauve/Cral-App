import { SlotResult } from '@/types'

export const SYMBOLS = ['💎', '7️⃣', '🍒', '⭐', '🔔', '🍋', '🍇', '💰']

// Weights: lower index = rarer
const SYMBOL_WEIGHTS = [1, 3, 8, 12, 15, 20, 25, 30] // total = 114

export function weightedRandom(): string {
  const total = SYMBOL_WEIGHTS.reduce((a, b) => a + b, 0)
  let rand = Math.random() * total
  for (let i = 0; i < SYMBOLS.length; i++) {
    rand -= SYMBOL_WEIGHTS[i]
    if (rand <= 0) return SYMBOLS[i]
  }
  return SYMBOLS[SYMBOLS.length - 1]
}

export function spinLine(): string[] {
  return [weightedRandom(), weightedRandom(), weightedRandom()]
}

export function evaluateLine(symbols: string[]): number {
  const [a, b, c] = symbols

  // Jackpot: 3 diamonds
  if (a === '💎' && b === '💎' && c === '💎') return 50

  // Three 7s
  if (a === '7️⃣' && b === '7️⃣' && c === '7️⃣') return 20

  // Three of a kind (other)
  if (a === b && b === c) {
    if (a === '⭐') return 10
    if (a === '🔔') return 8
    if (a === '🍒') return 6
    if (a === '💰') return 15
    return 5
  }

  // Two of a kind
  if (a === b || b === c || a === c) {
    if (a === '💎' || b === '💎' || c === '💎') return 2
    if (a === '7️⃣' || b === '7️⃣' || c === '7️⃣') return 1.5
    return 1.2
  }

  // Cherry bonus (any cherry)
  if (symbols.includes('🍒')) return 0.5

  return 0
}

export interface SpinResult {
  lines: SlotResult[]
  totalBet: number
  totalWin: number
  netResult: number
}

export function playSlots(linesPlayed: number, betPerLine: number): SpinResult {
  const lines: SlotResult[] = []
  let totalWin = 0
  const totalBet = linesPlayed * betPerLine

  for (let i = 0; i < linesPlayed; i++) {
    const symbols = spinLine()
    const multiplier = evaluateLine(symbols)
    const win = multiplier * betPerLine

    lines.push({
      line: i + 1,
      symbols,
      win,
      multiplier,
    })

    totalWin += win
  }

  return {
    lines,
    totalBet,
    totalWin: Math.round(totalWin * 100) / 100,
    netResult: Math.round((totalWin - totalBet) * 100) / 100,
  }
}

export function getMontrealDateString(): string {
  const now = new Date()
  const montreal = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montreal',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return montreal // returns YYYY-MM-DD
}

export function getTimeUntilReset(): string {
  const now = new Date()
  const montreal = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Montreal',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const h = parseInt(montreal.find(p => p.type === 'hour')?.value ?? '0')
  const m = parseInt(montreal.find(p => p.type === 'minute')?.value ?? '0')
  const s = parseInt(montreal.find(p => p.type === 'second')?.value ?? '0')

  const secondsUntilMidnight = (24 * 3600) - (h * 3600 + m * 60 + s)
  const hours = Math.floor(secondsUntilMidnight / 3600)
  const minutes = Math.floor((secondsUntilMidnight % 3600) / 60)
  const seconds = secondsUntilMidnight % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
