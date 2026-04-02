export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card { rank: Rank; suit: Suit }

const RANKS: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
const SUITS: Suit[] = ['♠','♥','♦','♣']

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ rank, suit })
  return shuffle(deck)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function cardValue(card: Card): number {
  if (['J','Q','K'].includes(card.rank)) return 10
  if (card.rank === 'A') return 11
  return parseInt(card.rank)
}

export function handValue(hand: Card[]): number {
  let total = hand.reduce((s, c) => s + cardValue(c), 0)
  let aces = hand.filter(c => c.rank === 'A').length
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

export function isBust(hand: Card[]): boolean {
  return handValue(hand) > 21
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21
}

export type BJResult = 'blackjack' | 'win' | 'push' | 'loss' | 'bust'

export function evaluateResult(player: Card[], dealer: Card[]): BJResult {
  const pv = handValue(player)
  const dv = handValue(dealer)
  if (isBust(player)) return 'bust'
  if (isBlackjack(player) && !isBlackjack(dealer)) return 'blackjack'
  if (isBust(dealer)) return 'win'
  if (pv > dv) return 'win'
  if (pv === dv) return 'push'
  return 'loss'
}

export function resultMultiplier(result: BJResult): number {
  if (result === 'blackjack') return 2.5 // 3:2 payout
  if (result === 'win') return 2
  if (result === 'push') return 1
  return 0
}

// Dealer strategy: hit on soft 16 or less, stand on 17+
export function dealerPlay(hand: Card[], deck: Card[]): { hand: Card[]; deck: Card[] } {
  const h = [...hand]
  const d = [...deck]
  while (handValue(h) < 17) {
    h.push(d.pop()!)
  }
  return { hand: h, deck: d }
}

export function cardColor(card: Card): string {
  return card.suit === '♥' || card.suit === '♦' ? '#e74c3c' : '#2c3e50'
}
