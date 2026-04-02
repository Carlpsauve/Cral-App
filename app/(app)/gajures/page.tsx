import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { formatCral, formatDate, getStatusLabel, getStatusColor, cn } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Swords, Globe } from 'lucide-react'

export const revalidate = 0

export default async function GajuresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: allBets } = await supabase
    .from('bets')
    .select(`
      *,
      creator:profiles!bets_creator_id_fkey(id, username, avatar_color),
      winner:profiles!bets_winner_id_fkey(id, username),
      participants:bet_participants(user_id, accepted, profile:profiles(id, username, avatar_color))
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const bets = allBets ?? []

  // Split: bets where I'm creator or participant vs others
  const myBets = bets.filter((b: any) =>
    b.creator_id === user.id ||
    b.participants?.some((p: any) => p.user_id === user.id)
  )

  const otherActiveBets = bets.filter((b: any) =>
    b.creator_id !== user.id &&
    !b.participants?.some((p: any) => p.user_id === user.id) &&
    b.status !== 'resolved' &&
    b.status !== 'cancelled'
  )

  // Count pending invitations for the user
  const pendingCount = myBets.filter((b: any) => {
    const myPart = b.participants?.find((p: any) => p.user_id === user.id)
    return myPart && !myPart.accepted && b.status !== 'resolved' && b.status !== 'cancelled'
  }).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text">Gajures</h1>
          <p className="text-cral-sub text-sm mt-1">Paris fictifs sur vos parties de jeux</p>
        </div>
        <Link href="/gajures/new" className="btn-gold flex items-center gap-2">
          <Plus size={16} />
          Nouvelle gajure
        </Link>
      </div>

      {/* Pending invitations alert */}
      {pendingCount > 0 && (
        <div className="rounded-xl px-5 py-4 flex items-center gap-3" style={{
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.3)'
        }}>
          <span className="text-xl">🎲</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-cral-text">
              {pendingCount} invitation{pendingCount > 1 ? 's' : ''} en attente
            </div>
            <div className="text-xs text-cral-sub mt-0.5">
              Cliquez sur une gajure ci-dessous pour accepter ou refuser
            </div>
          </div>
        </div>
      )}

      {/* My bets */}
      <section>
        <h2 className="font-display text-lg font-semibold text-cral-text mb-4 flex items-center gap-2">
          <Swords size={16} className="text-gold-400" />
          Mes gajures
          <span className="text-sm font-normal text-cral-muted">({myBets.length})</span>
        </h2>

        {myBets.length === 0 ? (
          <div className="card text-center py-14">
            <div className="text-4xl mb-3">🎲</div>
            <div className="text-sm text-cral-sub mb-4">Aucune gajure pour l&apos;instant.</div>
            <Link href="/gajures/new" className="btn-gold inline-flex items-center gap-2 text-sm">
              <Plus size={14} />
              Créer votre première gajure
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {myBets.map((bet: any) => (
              <BetCard key={bet.id} bet={bet} currentUserId={user.id} />
            ))}
          </div>
        )}
      </section>

      {/* Other active bets */}
      {otherActiveBets.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold text-cral-text mb-4 flex items-center gap-2">
            <Globe size={16} className="text-cral-sub" />
            Gajures en cours
            <span className="text-sm font-normal text-cral-muted">({otherActiveBets.length})</span>
          </h2>
          <div className="space-y-2">
            {otherActiveBets.map((bet: any) => (
              <BetCard key={bet.id} bet={bet} currentUserId={user.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function BetCard({ bet, currentUserId }: { bet: any; currentUserId: string }) {
  const isCreator = bet.creator_id === currentUserId
  const myParticipation = bet.participants?.find((p: any) => p.user_id === currentUserId)
  const isPendingMe = myParticipation && !myParticipation.accepted
  const acceptedCount = bet.participants?.filter((p: any) => p.accepted).length ?? 0
  const totalCount = bet.participants?.length ?? 0

  return (
    <Link href={`/gajures/${bet.id}`}
      className={cn(
        'card flex items-center justify-between gap-4 hover:border-gold-500/30 transition-all duration-200 group',
        isPendingMe && 'border-gold-500/40 bg-gold-400/5'
      )}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-medium text-cral-text group-hover:text-gold-100 transition-colors truncate">
            {bet.title}
          </span>
          {isCreator && (
            <span className="text-xs bg-gold-500/10 text-gold-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
              créateur
            </span>
          )}
          {isPendingMe && (
            <span className="text-xs bg-gold-500/20 text-gold-400 px-1.5 py-0.5 rounded-full flex-shrink-0 animate-pulse">
              ⏳ invitation
            </span>
          )}
        </div>
        <div className="text-xs text-cral-sub flex items-center gap-3 flex-wrap">
          <span>par {bet.creator?.username}</span>
          <span>{acceptedCount}/{totalCount} joueur{totalCount !== 1 ? 's' : ''}</span>
          <span>{formatDate(bet.created_at)}</span>
        </div>
        {bet.winner && (
          <div className="text-xs text-gold-400 mt-1">🏆 Gagnant: {bet.winner.username}</div>
        )}
        {/* Participant avatars */}
        {bet.participants?.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {bet.participants.slice(0, 6).map((p: any) => (
              <div key={p.user_id}
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-cral-bg transition-all',
                  p.accepted ? 'opacity-100' : 'opacity-40'
                )}
                style={{ backgroundColor: p.profile?.avatar_color ?? '#888' }}
                title={`${p.profile?.username}${!p.accepted ? ' (en attente)' : ''}`}>
                {(p.profile?.username ?? '?')[0].toUpperCase()}
              </div>
            ))}
            {bet.participants.length > 6 && (
              <span className="text-xs text-cral-muted">+{bet.participants.length - 6}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <div className="font-mono font-bold text-gold-400 text-sm">₡{formatCral(bet.amount)}</div>
          <div className="text-xs text-cral-muted">/ joueur</div>
        </div>
        <span className={cn('text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap', getStatusColor(bet.status))}>
          {getStatusLabel(bet.status)}
        </span>
      </div>
    </Link>
  )
}
