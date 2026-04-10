import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Dices, ShieldAlert, Clock, Calendar, Database, AlertTriangle, Users, User } from "lucide-react";

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ since?: string; view?: string }>
}

export default async function RngTrackerPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const sinceFilter = resolvedParams.since;
  const viewFilter = resolvedParams.view || 'me'; // 'me' par défaut

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', user.id).single();
  if (profile?.role !== 'super_admin' && profile?.role !== 'cral_slayer') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500">
        <ShieldAlert size={64} className="mb-4" />
        <h1 className="text-2xl font-bold">Accès Refusé</h1>
      </div>
    );
  }

  // 1. Requête à la base de données
  let query = supabase
    .from('user_cards')
    .select('rarity, tcgdex_id, obtained_at');

  // ✨ LOGIQUE DE VUE : Si 'me', on filtre par ton ID. Si 'all', on prend tout le monde !
  if (viewFilter === 'me') {
    query = query.eq('user_id', user.id);
  }

  const { data: rawCards, error } = await query;

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-20 bg-red-900/20 border border-red-500/50 p-8 rounded-2xl text-center">
        <AlertTriangle size={64} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Erreur de Base de Données</h2>
        <code className="bg-black/50 p-4 rounded text-sm text-gray-300 block text-left">{error.message}</code>
      </div>
    );
  }

  // 2. FILTRAGE TEMPOREL EN JAVASCRIPT
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const filteredCards = (rawCards || []).filter(card => {
    if (!card.obtained_at) return !sinceFilter; 
    const cardDate = new Date(card.obtained_at);
    if (sinceFilter === 'today') return cardDate >= startOfDay;
    if (sinceFilter === 'hour') return cardDate >= oneHourAgo;
    return true; 
  });

  // 3. Calcul des statistiques
  const stats = {
    pokemon: { total: 0, rarities: {} as Record<string, number> },
    lorcana: { total: 0, rarities: {} as Record<string, number> }
  };

  filteredCards.forEach(card => {
    const isLorcana = card.tcgdex_id.startsWith("lorcana-");
    const game = isLorcana ? stats.lorcana : stats.pokemon;
    const rarity = (card.rarity || "Inconnue").toLowerCase();
    game.total += 1;
    game.rarities[rarity] = (game.rarities[rarity] || 0) + 1;
  });

  const renderStatsTable = (title: string, gameStats: { total: number, rarities: Record<string, number> }) => {
    if (gameStats.total === 0) return <p className="text-gray-500 bg-gray-900/50 p-6 rounded-xl border border-gray-800">Aucune carte trouvée.</p>;
    const sortedRarities = Object.entries(gameStats.rarities).sort((a, b) => b[1] - a[1]);

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-gray-400 mb-6 text-sm italic">Échantillon : {gameStats.total} cartes</p>
        <div className="space-y-3">
          {sortedRarities.map(([rarity, count]) => {
            const percentage = ((count / gameStats.total) * 100).toFixed(2);
            const isGodPull = rarity.includes("enchanted") || rarity.includes("secret") || rarity.includes("legendary") || rarity.includes("vmax");
            return (
              <div key={rarity} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <span className={`font-medium capitalize ${isGodPull ? 'text-gold-400 font-bold' : 'text-gray-300'}`}>{rarity}</span>
                <div className="text-right">
                  <span className="text-white font-bold">{count}</span>
                  <span className="text-gray-500 text-[10px] ml-2 w-12 inline-block">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-gray-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-900/30 text-purple-400 rounded-xl"><Dices size={32} /></div>
          <div>
            <h1 className="text-3xl font-bold text-white">Laboratoire RNG</h1>
            <p className="text-gray-400 text-sm">Mode : <span className="text-purple-400 font-bold uppercase">{viewFilter === 'all' ? 'Global (Tous les joueurs)' : 'Personnel'}</span></p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {/* SÉLECTEUR DE VUE (MOI vs TOUS) */}
          <div className="flex bg-black/40 border border-gray-800 rounded-lg p-1">
            <Link href={`/admin/rng-tracker?view=me${sinceFilter ? `&since=${sinceFilter}` : ''}`} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${viewFilter === 'me' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>
              <User size={14} /> Ma chance
            </Link>
            <Link href={`/admin/rng-tracker?view=all${sinceFilter ? `&since=${sinceFilter}` : ''}`} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${viewFilter === 'all' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>
              <Users size={14} /> Global
            </Link>
          </div>

          {/* SÉLECTEUR DE TEMPS */}
          <div className="flex bg-black/40 border border-gray-800 rounded-lg p-1">
            <Link href={`/admin/rng-tracker?view=${viewFilter}`} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${!sinceFilter ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
              <Database size={14} />
            </Link>
            <Link href={`/admin/rng-tracker?view=${viewFilter}&since=today`} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${sinceFilter === 'today' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>
              Aujourd'hui
            </Link>
            <Link href={`/admin/rng-tracker?view=${viewFilter}&since=hour`} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${sinceFilter === 'hour' ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-white'}`}>
              1h
            </Link>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {renderStatsTable("🔴 Pokémon", stats.pokemon)}
        {renderStatsTable("✨ Lorcana", stats.lorcana)}
      </div>
    </div>
  );
}