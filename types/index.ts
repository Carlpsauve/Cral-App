export type Role = 'super_admin' | 'plebe'

export interface Profile {
  id: string
  username: string
  email: string
  balance: number
  role: Role
  avatar_color: string
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
  created_at: string
  profile?: Profile
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
  type: 'bet_win' | 'bet_loss' | 'daily_win' | 'daily_loss' | 'admin_credit' | 'admin_debit' | 'signup_bonus'
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
