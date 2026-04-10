"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X, Trash2, Coins, Layers, Eye, EyeOff, Filter, BookOpen, Store, Loader2, Award } from "lucide-react";
import HoloCard from "@/components/ui/HoloCard"; 

import { BOOSTER_CONFIG } from "@/config/boosters";
import { RARITY_RATIOS, SPECIAL_CARD_PRICES } from "@/config/cards";

import { createClient } from "@/lib/supabase-client";

export type CollectionItem = any & { quantity: number; card_ids: string[] };

const getBasePrice = (rarity: string | undefined, name: string, setId: string) => {
  const cardName = (name || "").toLowerCase();
  const cardRarity = (rarity || "").toLowerCase();
  const specialKey = Object.keys(SPECIAL_CARD_PRICES).find(key => cardName.includes(key));
  if (specialKey) return SPECIAL_CARD_PRICES[specialKey as keyof typeof SPECIAL_CARD_PRICES];

  const config = BOOSTER_CONFIG[setId as keyof typeof BOOSTER_CONFIG];
  const packPrice = config?.price || 20;
  const gameType = config?.game || "pokemon";
  const gameRatios = RARITY_RATIOS[gameType] || RARITY_RATIOS["pokemon"];
  const ratioKey = Object.keys(gameRatios).find(key => cardRarity.includes(key));
  return Math.round((packPrice * (ratioKey ? gameRatios[ratioKey] : 0.05)) * 10) / 10;
};

// ✨ DICTIONNAIRE DES RÉCOMPENSES DE SETS (Version Robuste) ✨
const SET_REWARDS: Record<string, { title: string, targetCount: number }> = {
  'base1': { title: 'boomer_base_set', targetCount: 102 }, 
  // 'lorcana-first-chapter': { title: 'buveur_encre', targetCount: 204 }, <-- Exemple pour Lorcana
};

export default function CollectionClient({ 
  collection, 
  referenceCards = [], 
  boosters = [],       
  selectedSet, 
  showMissing = false, 
  isPublic = false,
  username = "Joueur" 
}: { 
  collection: any[], 
  referenceCards?: any[],
  boosters?: any[],
  selectedSet?: string,
  showMissing?: boolean,
  isPublic?: boolean,
  username?: string
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showSellSingleModal, setShowSellSingleModal] = useState(false); 
  const [isSelling, setIsSelling] = useState(false);
  const [isSellingSingle, setIsSellingSingle] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CollectionItem | null>(null);

  // ✨ ÉTATS POUR LE SYSTÈME DE TITRE ET LE POPUP ✨
  const [unlockedTitles, setUnlockedTitles] = useState<string[]>([]);
  const [isClaimingTitle, setIsClaimingTitle] = useState(false);
  const [hideClaimPopup, setHideClaimPopup] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    async function fetchUserTitles() {
      if (isPublic) return; 
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase.from('profiles').select('unlocked_titles').eq('id', user.id).single();
      if (data && data.unlocked_titles) {
        setUnlockedTitles(data.unlocked_titles);
      }
    }
    
    fetchUserTitles();
  }, [isPublic]);

  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState("Toutes");
  const [sortBy, setSortBy] = useState(selectedSet ? "number" : "value_desc");

  const updateUrl = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  const finalDisplay = useMemo(() => {
    if (showMissing && selectedSet && referenceCards.length > 0) {
      return referenceCards.map(ref => {
        const ownedItems = collection.filter(c => c.id === ref.id || c.tcgdex_id === ref.id);
        const owned = ownedItems.length > 0 ? ownedItems[0] : null;
        return {
          ...ref,
          id: ref.id,
          localId: ref.localId,
          name: ref.name,
          image: ref.image || ref.images?.small || ref.images?.high || owned?.image, 
          rarity: ref.rarity || owned?.rarity || "Common",
          price: owned ? owned.price : getBasePrice(ref.rarity, ref.name, selectedSet),
          isMissing: !owned,
          quantity: ownedItems.reduce((acc, curr) => acc + (curr.quantity || 1), 0),
          card_ids: ownedItems.flatMap(e => e.card_ids || [])
        };
      });
    }
    return collection;
  }, [collection, referenceCards, showMissing, selectedSet]);

  const filteredData = useMemo(() => {
    let result = finalDisplay.filter((item) => {
      const matchName = item.name.toLowerCase().includes(search.toLowerCase());
      const matchRarity = rarityFilter === "Toutes" || item.rarity === rarityFilter;
      return matchName && matchRarity;
    });
    result.sort((a, b) => {
      if (sortBy === "number") {
        const idA = a.localId ? String(a.localId) : "0";
        const idB = b.localId ? String(b.localId) : "0";
        return idA.localeCompare(idB, undefined, { numeric: true });
      }
      if (sortBy === "value_desc") return (b.price || 0) - (a.price || 0);
      if (sortBy === "value_asc") return (a.price || 0) - (b.price || 0);
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [finalDisplay, search, rarityFilter, sortBy]);

  const stats = useMemo(() => {
    let totalValue = 0;
    let dupesCount = 0;
    let dupesValue = 0;
    collection.forEach(item => {
      totalValue += (item.price || 0) * (item.quantity || 1);
      if (item.quantity > 1) {
        const count = item.quantity - 1;
        dupesCount += count;
        dupesValue += count * (item.price || 0);
      }
    });
    return { 
      totalValue: Math.round(totalValue * 10) / 10, 
      dupesCount, 
      dupesValue: Math.round(dupesValue * 10) / 10,
      uniqueCount: collection.length 
    };
  }, [collection]);

  // ✨ LOGIQUE DE VÉRIFICATION DE COMPLÉTION DU SET (Version Robuste) ✨
  const rewardConfig = selectedSet ? SET_REWARDS[selectedSet] : null;
  const titleToClaim = rewardConfig ? rewardConfig.title : null;

  const isCurrentSetComplete = useMemo(() => {
    if (!rewardConfig) return false;
    // La collection est déjà filtrée pour le set sélectionné par ton API / backend.
    // 'collection.length' représente le nombre de cartes UNIQUES que le joueur possède dans ce set.
    return collection.length >= rewardConfig.targetCount;
  }, [rewardConfig, collection]);

  const canClaimTitle = !isPublic && isCurrentSetComplete && titleToClaim && !unlockedTitles.includes(titleToClaim);

  const handleClaimTitle = async () => {
    if (!titleToClaim || isClaimingTitle) return;
    setIsClaimingTitle(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");

      const newTitles = [...unlockedTitles, titleToClaim];
      const { error } = await supabase.from('profiles').update({ unlocked_titles: newTitles }).eq('id', user.id);
      if (error) throw error;

      setUnlockedTitles(newTitles); // Le popup va disparaître tout seul car canClaimTitle deviendra false
    } catch (error: any) {
      alert("Erreur lors de la réclamation du titre : " + error.message);
      setIsClaimingTitle(false);
    }
  };

  const confirmSellDuplicates = async () => {
    if (isSelling) return;
    setIsSelling(true);
    try {
      const res = await fetch("/api/shop/sell-duplicates", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setShowSellModal(false);
      router.refresh();
    } catch (error: any) { alert(error.message); } finally { setIsSelling(false); }
  };

  const confirmSellSingleCard = async () => {
    if (!selectedCard || selectedCard.card_ids.length === 0 || isSellingSingle) return;
    setIsSellingSingle(true);
    try {
      const targetCardId = selectedCard.card_ids[0];
      const res = await fetch("/api/shop/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: targetCardId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la vente");
      
      setShowSellSingleModal(false); 
      
      if (selectedCard.quantity > 1) {
        setSelectedCard((prev: CollectionItem | null) => {
          if (!prev) return null;
          return { ...prev, quantity: prev.quantity - 1, card_ids: prev.card_ids.slice(1) };
        });
      } else {
        setSelectedCard(null); 
      }
      router.refresh(); 
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSellingSingle(false);
    }
  };

  return (
    <div className="space-y-8 relative">
      
      {/* 1. EN-TÊTE STATISTIQUES */}
      <div className="bg-gray-900/50 border border-white/5 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">
              {isPublic ? `Classeur de ${username}` : "Mon Classeur"}
            </h1>
            <p className="text-gray-400 font-medium">{stats.uniqueCount} cartes uniques collectées</p>
          </div>
          
          <div className="flex flex-col items-end gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-gold-500 font-black mb-1">Estimation du classeur</p>
              <p className="text-5xl font-mono font-black text-gold-400 tracking-tighter">
                ₡{mounted ? stats.totalValue.toLocaleString() : "---"}
              </p>
            </div>

            {!isPublic && stats.dupesCount > 0 && (
              <button 
                onClick={() => setShowSellModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-red-950/30 hover:bg-red-900/40 border border-red-900/50 text-red-400 rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-900/10"
              >
                <Trash2 size={18} />
                Vendre les {stats.dupesCount} doublons (~₡{mounted ? stats.dupesValue.toLocaleString() : "---"})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. BARRE DE FILTRES */}
      <div className="bg-gray-900/80 p-4 rounded-2xl border border-gray-800 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
          <Filter size={18} className="text-gray-400" />
          <select value={selectedSet || ''} onChange={(e) => updateUrl('set', e.target.value || null)} className="bg-transparent text-white outline-none text-sm font-bold min-w-[150px]">
            <option value="">Tous les Boosters</option>
            {boosters.map(([id, config]: any) => <option key={id} value={id}>{config.name}</option>)}
          </select>
        </div>

        {selectedSet && (
          <button onClick={() => updateUrl('showMissing', showMissing ? null : 'true')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${showMissing ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {showMissing ? <Eye size={18} /> : <EyeOff size={18} />} {showMissing ? 'Mode Album' : 'Voir manquantes'}
          </button>
        )}

        <div className="flex-1 min-w-[200px]">
          <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-blue-500 outline-none" />
        </div>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 outline-none font-bold">
          <option value="number">📖 Ordre de l'Album</option>
          <option value="value_desc">💸 Prix ↓</option>
          <option value="value_asc">🪙 Prix ↑</option>
        </select>
      </div>

      {/* 3. GRILLE DE CARTES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
        {filteredData.map((item) => (
          <div key={item.id} className="relative group">
            {!item.isMissing && item.quantity > 1 && (
              <div className="absolute -top-2 -right-2 z-30 bg-blue-600 text-white text-xs font-black px-2 py-1 rounded-full border-2 border-gray-900 shadow-xl group-hover:scale-110 transition-transform">x{item.quantity}</div>
            )}
            <div className={`w-full transition-all duration-300 ${item.isMissing ? "grayscale opacity-50 blur-[1px] brightness-[0.5] hover:grayscale-0 hover:opacity-100 hover:blur-0 hover:brightness-100" : "hover:scale-105"}`}>
              <HoloCard card={item} isFlipped={true} isStatic={item.isMissing} className="w-full" onClick={() => !item.isMissing && setSelectedCard(item)} />
            </div>
            {item.isMissing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span className="bg-black/80 text-[10px] text-white px-2 py-1 rounded-md border border-white/20 font-black uppercase tracking-widest backdrop-blur-sm">Manquante</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ✨ POPUP GÉANT DE COMPLÉTION DE SET ✨ */}
      {canClaimTitle && !hideClaimPopup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setHideClaimPopup(true)}>
          <div className="relative bg-[#0f111a] border-2 border-yellow-500/50 rounded-[32px] p-8 md:p-12 max-w-lg w-full text-center shadow-[0_0_100px_rgba(234,179,8,0.2)] overflow-hidden animate-in zoom-in duration-500" onClick={(e) => e.stopPropagation()}>
            
            {/* Petit halo lumineux en arrière plan */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-500/20 blur-[100px] pointer-events-none"></div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-gold-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.5)] mb-6 border-4 border-yellow-200">
                <Award className="text-black" size={48} />
              </div>
              
              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-gold-600 mb-2 uppercase tracking-tight">Incroyable !</h2>
              <p className="text-xl text-gray-200 font-bold mb-6">Tu as complété toutes les cartes de cette extension !</p>
              
              <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                En guise de récompense pour cet exploit monumental, tu débloques un Titre Exclusif pour décorer ton profil public.
              </p>

              <button 
                onClick={handleClaimTitle}
                disabled={isClaimingTitle}
                className="w-full py-5 bg-gradient-to-r from-yellow-500 to-gold-600 hover:from-yellow-400 hover:to-gold-500 text-black font-black text-lg rounded-2xl transition-all hover:scale-105 shadow-xl shadow-yellow-500/30 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-wider"
              >
                {isClaimingTitle ? <Loader2 className="animate-spin" size={24} /> : "🏆 Réclamer mon Titre !"}
              </button>
              
              <button 
                onClick={() => setHideClaimPopup(true)}
                className="mt-6 text-gray-500 hover:text-white font-medium text-sm transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL VENTE DE MASSE */}
      {showSellModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => !isSelling && setShowSellModal(false)}>
          <div className="bg-[#0f111a] border border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-red-500/20 p-3 rounded-2xl"><Trash2 className="text-red-500" size={24} /></div>
              <h2 className="text-2xl font-black text-white">Vente de masse</h2>
            </div>
            <p className="text-gray-400 text-lg mb-8">Vendre tes <span className="text-white font-bold">{stats.dupesCount} doublons</span> pour <span className="text-gold-400 font-mono font-bold">₡{mounted ? stats.dupesValue.toLocaleString() : "---"}</span> ?</p>
            <div className="flex gap-4">
              <button disabled={isSelling} onClick={() => setShowSellModal(false)} className="flex-1 py-4 px-6 bg-gray-800/50 hover:bg-gray-800 text-white rounded-2xl font-bold transition-all border border-white/5 disabled:opacity-50">Annuler</button>
              <button disabled={isSelling} onClick={confirmSellDuplicates} className="flex-1 py-4 px-6 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-500/50 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">{isSelling ? <Loader2 className="animate-spin" size={20} /> : "Vendre"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL D'INSPECTION */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setSelectedCard(null)}>
           <div className="relative flex flex-col md:flex-row bg-[#0a0a0f] border border-white/10 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="relative w-full md:w-1/2 p-8 flex items-center justify-center bg-black/40 border-r border-white/5">
                <HoloCard card={selectedCard} isFlipped={true} className="w-[200px] sm:w-[280px]" />
              </div>
              <div className="p-8 flex flex-col justify-center w-full md:w-1/2 overflow-y-auto">
                 <h2 className="text-4xl font-black text-white mb-2">{selectedCard.name}</h2>
                 <p className="text-blue-400 font-bold mb-6 uppercase tracking-wider">{selectedCard.rarity}</p>
                 <div className="flex gap-4 mb-8">
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 flex-1">
                       <p className="text-xs text-gray-500 uppercase font-bold mb-1">Valeur Est.</p>
                       <p className="text-2xl font-mono text-gold-400">₡{selectedCard.price}</p>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 flex-1">
                       <p className="text-xs text-gray-500 uppercase font-bold mb-1">Stock</p>
                       <p className="text-2xl font-mono text-white">x{selectedCard.quantity}</p>
                    </div>
                 </div>
                 <div className="bg-gray-900/30 p-4 rounded-xl border border-gray-800 mb-8 text-sm text-gray-400">
                    <p className="uppercase text-[10px] mb-1">Set / Extension</p>
                    <p className="text-white font-medium">{selectedCard.set?.name || "Inconnu"}</p>
                 </div>
                 {!isPublic && (
                   <button disabled={isSellingSingle} onClick={() => setShowSellSingleModal(true)} className="w-full mb-3 py-4 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl font-black text-sm uppercase tracking-widest transition-all border border-red-900/50 flex justify-center items-center gap-2 disabled:opacity-50">
                     Vendre (~₡{selectedCard.price})
                   </button>
                 )}
                 <button onClick={() => setSelectedCard(null)} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-sm uppercase transition-all border border-white/5">
                   Fermer
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* 6. MODAL VENTE INDIVIDUELLE IN-APP */}
      {showSellSingleModal && selectedCard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => !isSellingSingle && setShowSellSingleModal(false)}>
          <div className="bg-[#0f111a] border border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-red-500/20 p-3 rounded-2xl"><Trash2 className="text-red-500" size={24} /></div>
              <h2 className="text-2xl font-black text-white">Vente de carte</h2>
            </div>
            <p className="text-gray-400 text-lg mb-8">
              Es-tu sûr de vouloir vendre <span className="text-white font-bold">{selectedCard.name}</span> pour <span className="text-gold-400 font-mono font-bold">₡{selectedCard.price}</span> ?
            </p>
            <div className="flex gap-4">
              <button disabled={isSellingSingle} onClick={() => setShowSellSingleModal(false)} className="flex-1 py-4 px-6 bg-gray-800/50 hover:bg-gray-800 text-white rounded-2xl font-bold transition-all border border-white/5 disabled:opacity-50">Annuler</button>
              <button disabled={isSellingSingle} onClick={confirmSellSingleCard} className="flex-1 py-4 px-6 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-500/50 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">{isSellingSingle ? <Loader2 className="animate-spin" size={20} /> : "Vendre"}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}