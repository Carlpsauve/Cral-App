import { createClient } from '@/lib/supabase-server'
import { formatCral, getInitials } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { redirect } from 'next/navigation'
import { Trophy, TrendingUp, BookOpen, Gem } from 'lucide-react'
import Link from 'next/link'
import ClassementToggle from '@/components/shop/ClassementToggle'
import { BOOSTER_CONFIG } from '@/config/boosters'
import { RARITY_RATIOS, SPECIAL_CARD_PRICES } from '@/config/cards'
import { getCardDetails } from '@/lib/tcgdex'

export const revalidate = 30

// Fonction pour évaluer une carte
const calculateCardValue = (card: any) => {
  if (!card || !card.name) return 0;
  
  const cardName = card.name.toLowerCase();
  
  // Exceptions VIP
  const specialKey = Object.keys(SPECIAL_CARD_PRICES).find(k => cardName.includes(k));
  if (specialKey) return SPECIAL_CARD_PRICES[specialKey as keyof typeof SPECIAL_CARD_PRICES];

  // Calcul basé sur la rareté
  const packPrice = BOOSTER_CONFIG[card.set?.id as keyof typeof BOOSTER_CONFIG]?.price || 20;
  const ratioKey = Object.keys(RARITY_RATIOS).find(k => card.rarity?.toLowerCase().includes(k));
  const ratio = ratioKey ? RARITY_RATIOS[ratioKey] : 0.05;
  
  return Math.round((packPrice * ratio) * 10) / 10;
};

type Props = {
  searchParams: Promise<{ view?: string }>
}

export default async function ClassementPage({ searchParams }: Props) {
  // 2. On "await" searchParams avant de lire ".view"
  const resolvedSearchParams = await searchParams;
  const view = resolvedSearchParams.view || 'cash';
  
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // --- 1. RÉCUPÉRATION DES DONNÉES DE BASE ---
  const { data: rawPlayers } = await supabase
    .from('profiles')
    .select('id, username, balance, avatar_color, avatar_svg, role')

  const { data: dailyWins } = await supabase
    .from('daily_plays')
    .select('user_id, total_win')

  const winsByUser: Record<string, number> = {}
  dailyWins?.forEach(d => {
    winsByUser[d.user_id] = (winsByUser[d.user_id] ?? 0) + d.total_win
  })

  const { data: betWins } = await supabase
    .from('transactions')
    .select('user_id, amount')
    .eq('type', 'bet_win')

  const betWinsByUser: Record<string, number> = {}
  betWins?.forEach(t => {
    betWinsByUser[t.user_id] = (betWinsByUser[t.user_id] ?? 0) + t.amount
  })

  // --- 2. CALCUL DU PATRIMOINE (CARTES) ---
  const { data: allCards } = await supabase
    .from('user_cards')
    .select('user_id, tcgdex_id');

  const assetValues: Record<string, number> = {};

  if (allCards && allCards.length > 0) {
    // OPTIMISATION : On liste les IDs uniques pour ne pas appeler TCGdex 1000 fois
    const uniqueCardIds = Array.from(new Set(allCards.map(c => c.tcgdex_id)));
    const cardDetailsCache: Record<string, any> = {};

    // On récupère les détails (En Promise.all pour aller plus vite)
    await Promise.all(
      uniqueCardIds.map(async (id) => {
        const details = await getCardDetails(id);
        if (details) cardDetailsCache[id] = details;
      })
    );

    // On additionne la valeur des cartes pour chaque joueur
    allCards.forEach(c => {
      const details = cardDetailsCache[c.tcgdex_id];
      if (details) {
        const val = calculateCardValue(details);
        assetValues[c.user_id] = (assetValues[c.user_id] || 0) + val;
      }
    });
  }

  // --- 3. PRÉPARATION ET TRI DES JOUEURS ---
  let players = rawPlayers?.map(p => ({
    ...p,
    collectionValue: assetValues[p.id] || 0,
    totalValue: p.balance + (assetValues[p.id] || 0)
  })) || [];

  // Tri selon le bouton sélectionné
  players.sort((a, b) => view === 'cash' ? b.balance - a.balance : b.totalValue - a.totalValue);

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-8">
      {/* En-tête avec Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-3">
            <Trophy className={view === 'cash' ? "text-gold-400" : "text-blue-400"} size={28} />
            Classement {view === 'assets' && <span className="text-blue-400">Patrimoine</span>}
          </h1>
          <p className="text-cral-sub text-sm mt-1">
            {view === 'cash' ? "Qui domine les soirées ?" : "L'empire financier (Liquidité + Cartes)"}
          </p>
        </div>
        
        <ClassementToggle />
      </div>

      {/* Podium */}
      {players && players.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {[players[1], players[0], players[2]].map((p, visualIdx) => {
            if (!p) return null;
            const rank = visualIdx === 0 ? 1 : visualIdx === 1 ? 0 : 2
            const isFirst = rank === 0
            const displayValue = view === 'cash' ? p.balance : p.totalValue

            return (
              <div
                key={p.id}
                className={`relative rounded-2xl p-4 text-center transition-all ${
                  isFirst ? (view === 'cash' ? 'glow-gold' : 'shadow-[0_0_15px_rgba(37,99,235,0.3)]') : ''
                }`}
                style={{
                  background: isFirst
                    ? (view === 'cash' 
                        ? 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))'
                        : 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(37,99,235,0.05))')
                    : '#1a1a26',
                  border: isFirst 
                    ? (view === 'cash' ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(37,99,235,0.4)') 
                    : '1px solid #2a2a40',
                  marginTop: isFirst ? 0 : '1rem',
                }}
              >
                <Link 
                  href={`/shop/collection/${p.id}`}
                  className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${
                    view === 'cash' ? 'text-cral-muted hover:text-gold-400 hover:bg-gold-500/10' : 'text-cral-muted hover:text-blue-400 hover:bg-blue-500/10'
                  }`}
                  title={`Voir la collection de ${p.username}`}
                >
                  <BookOpen size={16} />
                </Link>

                <div className="text-2xl mb-2">{medals[rank]}</div>
                <Avatar username={p.username} avatarColor={p.avatar_color} avatarSvg={p.avatar_svg} size={48} className="mx-auto mb-2" />
                <div className="text-sm font-medium text-cral-text truncate">{p.username}</div>
                
                <div className={`font-mono font-bold mt-1 ${isFirst ? (view === 'cash' ? 'text-gold-400 text-lg' : 'text-blue-400 text-lg') : 'text-cral-sub text-sm'}`}>
                  ₡{formatCral(displayValue)}
                </div>

                {view === 'assets' && (
                  <div className="text-[10px] text-blue-400/80 font-bold uppercase tracking-wider mt-1">
                    Dont ₡{formatCral(p.collectionValue)} en cartes
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Full ranking */}
      <div className="card">
        <div className="space-y-1">
          {players?.map((p, idx) => {
            const isMe = p.id === user.id
            const displayValue = view === 'cash' ? p.balance : p.totalValue
            
            return (
              <div
                key={p.id}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-150 ${
                  isMe 
                    ? (view === 'cash' ? 'bg-gold-400/10 border border-gold-400/20' : 'bg-blue-600/10 border border-blue-500/20') 
                    : 'hover:bg-cral-surface'
                }`}
              >
                <div className={`w-8 text-center font-mono font-bold text-sm flex-shrink-0 ${
                  idx === 0 ? (view === 'cash' ? 'text-gold-400' : 'text-blue-400') : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-cral-muted'
                }`}>
                  {idx < 3 ? medals[idx] : `#${idx + 1}`}
                </div>

                <Avatar username={p.username} avatarColor={p.avatar_color} avatarSvg={p.avatar_svg} size={36} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-cral-text truncate">{p.username}</span>
                    {isMe && <span className={`text-xs ${view === 'cash' ? 'text-gold-500' : 'text-blue-400'}`}>vous</span>}
                    {p.role === 'super_admin' && <span className="text-xs text-purple-400">admin</span>}
                    {p.role === 'homme_blanc_chauve' && <span className="text-xs text-purple-300">🦲</span>}
                  </div>
                  
                  <div className="text-xs text-cral-sub flex items-center gap-3 mt-0.5">
                    {view === 'cash' ? (
                      <>
                        <span>🎲 ₡{formatCral(betWinsByUser[p.id] ?? 0)}</span>
                        <span>🎰 ₡{formatCral(winsByUser[p.id] ?? 0)}</span>
                      </>
                    ) : (
                      <span className="text-blue-400/80 flex items-center gap-1 font-semibold">
                        <Gem size={10} /> Cartes : ₡{formatCral(p.collectionValue)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className={`font-mono font-bold text-sm ${view === 'assets' ? 'text-blue-400' : 'text-cral-text'}`}>
                    ₡{formatCral(displayValue)}
                  </div>
                  {view === 'cash' && (
                    <div className={`text-xs flex items-center gap-1 justify-end ${
                      p.balance >= 100 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      <TrendingUp size={10} />
                      {p.balance >= 100 ? '+' : ''}{formatCral(p.balance - 100)}
                    </div>
                  )}
                </div>

                <Link 
                  href={`/shop/collection/${p.id}`}
                  className={`ml-2 p-2 rounded-full transition-all group flex items-center justify-center flex-shrink-0 ${
                    view === 'cash' ? 'text-cral-muted hover:text-gold-400 hover:bg-gold-500/10' : 'text-cral-muted hover:text-blue-400 hover:bg-blue-500/10'
                  }`}
                  title={`Voir la collection de ${p.username}`}
                >
                  <BookOpen size={18} className="group-hover:scale-110 transition-transform" />
                </Link>

              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}