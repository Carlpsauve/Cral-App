export type Role = 'super_admin' | 'plebe' | 'homme_blanc_chauve'

export interface Profile {
  id: string
  username: string
  email: string
  balance: number
  role: Role
  avatar_color: string
  avatar_svg: string | null
  created_at: string
  updated_at: string
}

export interface Bet {
  id: string
  title: string
  description: string | null
  creator_id: string
  amount: number
  status: 'pending' | 'active' | 'voting' | 'resolved' | 'cancelled'
  winner_id: string | null
  created_at: string
  resolved_at: string | null
  creator?: Profile
  winner?: Profile
  participants?: BetParticipant[]
  votes?: BetVote[]
}

export interface BetParticipant {
  id: string
  bet_id: string
  user_id: string
  accepted: boolean
  prediction: string | null
  team: string | null
  created_at: string
  profile?: Profile
}

export interface BetCancelVote {
  id: string
  bet_id: string
  voter_id: string
  created_at: string
  voter?: Profile
}

export interface BetVote {
  id: string
  bet_id: string
  voter_id: string
  voted_for_id: string
  created_at: string
  voter?: Profile
  voted_for?: Profile
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  type: 'bet_win' | 'bet_loss' | 'bet_pending' | 'bet_refund' | 'daily_win' | 'daily_loss' | 'daily_free_win' | 'blackjack_win' | 'blackjack_loss' | 'admin_credit' | 'admin_debit' | 'signup_bonus' | 'hbc_upgrade'
  description: string
  reference_id: string | null
  created_at: string
  profile?: Profile
}

export interface DailyPlay {
  id: string
  user_id: string
  played_at: string
  lines_played: number
  bet_per_line: number
  total_bet: number
  result: SlotResult[]
  total_win: number
  is_free_bet: boolean
  created_at: string
}

export interface SlotResult {
  line: number
  symbols: string[]
  win: number
  multiplier: number
}

export interface LeaderboardEntry {
  id: string
  username: string
  balance: number
  avatar_color: string
  rank: number
}
export interface CasinoSession {
  id: string
  user_id: string
  session_date: string
  game: 'blackjack' | 'slot'
  total_won: number
}

export interface GeoQuestion {
  id: number
  clues: string[]
  options: string[]
  answer: string
  reward: number // base reward in Cral$
}
