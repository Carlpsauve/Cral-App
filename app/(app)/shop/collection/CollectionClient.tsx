"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Sparkles } from "lucide-react";
import { TCGCardDetails } from "@/lib/tcgdex";
import { BOOSTER_CONFIG } from "@/config/boosters";
import { RARITY_RATIOS, SPECIAL_CARD_PRICES } from "@/config/cards";

export type CollectionItem = TCGCardDetails & { quantity: number; card_ids: string[] };

// OPTIMISATION : On sort la fonction du composant pour de meilleures performances
const getBasePrice = (rarity: string | undefined, name: string, setId: string) => {
  const cardName = name.toLowerCase();

  // 1. Exceptions VIP (Prix fixes prioritaires)
  const specialKey = Object.keys(SPECIAL_CARD_PRICES).find(key => 
      cardName.includes(key)
  );
  if (specialKey) {
      return SPECIAL_CARD_PRICES[specialKey as keyof typeof SPECIAL_CARD_PRICES];
  }

  // 2. Calcul dynamique basé sur le prix du booster
  const packPrice = BOOSTER_CONFIG[setId as keyof typeof BOOSTER_CONFIG]?.price || 20;
  
  const r = rarity?.toLowerCase() || "";
  const ratioKey = Object.keys(RARITY_RATIOS).find(key => 
      r.includes(key)
  );

  const ratio = ratioKey ? RARITY_RATIOS[ratioKey] : 0.05; // 5% par défaut (commune)
  
  return Math.round((packPrice * ratio) * 10) / 10;
};


export default function CollectionClient({ collection, isPublic = false }: { collection: CollectionItem[], isPublic?: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState("Toutes");
  // NOUVEAU : État pour le tri (par défaut: les plus chères en premier)
  const [sortBy, setSortBy] = useState("value_desc"); 
  const [selectedCard, setSelectedCard] = useState<CollectionItem | null>(null);
  const [isSelling, setIsSelling] = useState(false);

  // Liste unique des raretés présentes dans la collection pour le filtre
  const rarities = ["Toutes", ...Array.from(new Set(collection.map((c) => c.rarity).filter(Boolean)))];

  // Calcul de la valeur totale du classeur
  const totalCollectionValue = useMemo(() => {
    return collection.reduce((acc, item) => {
        const unitPrice = getBasePrice(item.rarity, item.name, item.set.id);
        return acc + (unitPrice * item.quantity);
    }, 0);
  }, [collection]);

  // Filtrage ET Tri de la collection
  const filteredCollection = useMemo(() => {
    // 1. On filtre d'abord
    let result = collection.filter((item) => {
      const matchName = item.name.toLowerCase().includes(search.toLowerCase());
      const matchRarity = rarityFilter === "Toutes" || item.rarity === rarityFilter;
      return matchName && matchRarity;
    });

    // 2. On trie ensuite le résultat
    result.sort((a, b) => {
      if (sortBy === "value_desc" || sortBy === "value_asc") {
        const priceA = getBasePrice(a.rarity, a.name, a.set.id);
        const priceB = getBasePrice(b.rarity, b.name, b.set.id);
        
        if (sortBy === "value_desc") return priceB - priceA; // Plus cher au moins cher
        return priceA - priceB; // Moins cher au plus cher
      }
      
      if (sortBy === "name_asc") {
        return a.name.localeCompare(b.name); // Ordre alphabétique
      }

      return 0;
    });

    return result;
  }, [collection, search, rarityFilter, sortBy]); // On ajoute sortBy dans les dépendances

  const handleSellCard = async () => {
    if (!selectedCard || selectedCard.card_ids.length === 0) return;
    setIsSelling(true);

    try {
      const cardIdToSell = selectedCard.card_ids[selectedCard.card_ids.length - 1];

      const res = await fetch("/api/shop/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: cardIdToSell,
          tcgdexId: selectedCard.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.refresh();

      if (selectedCard.quantity > 1) {
        setSelectedCard({
          ...selectedCard,
          quantity: selectedCard.quantity - 1,
          card_ids: selectedCard.card_ids.slice(0, -1)
        });
      } else {
        setSelectedCard(null);
      }

    } catch (error) {
      console.error("Erreur lors de la vente:", error);
      alert("Erreur lors de la vente de la carte.");
    } finally {
      setIsSelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* EN-TÊTE DE VALEUR TOTALE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-gray-900/50 p-6 rounded-2xl border border-gray-800 shadow-xl">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            Classeur Pokémon 
            {isPublic && (
              <span className="text-sm font-normal text-gray-500 bg-gray-800 px-3 py-1 rounded-full italic">
                Vue publique
              </span>
            )}
          </h1>
          <p className="text-gray-400 mt-1">{collection.length} cartes uniques collectées</p>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-1">
            Estimation du classeur
          </span>
          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 drop-shadow-sm">
            ₡{totalCollectionValue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Barre de filtres et de tri */}
      <div className="flex flex-col sm:flex-row gap-4 bg-gray-900 p-4 rounded-lg border border-gray-800">
        <input
          type="text"
          placeholder="Rechercher une carte..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-800 text-white rounded-md px-4 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
        />
        
        <select
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value)}
          className="bg-gray-800 text-white rounded-md px-4 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
        >
          {rarities.map((rarity) => (
            <option key={rarity} value={rarity}>{rarity}</option>
          ))}
        </select>

        {/* NOUVEAU : Menu déroulant pour le tri */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-gray-800 text-white rounded-md px-4 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 font-medium"
        >
          <option value="value_desc">💸 Valeur (Plus chère)</option>
          <option value="value_asc">🪙 Valeur (Moins chère)</option>
          <option value="name_asc">🔤 Nom (A - Z)</option>
        </select>
      </div>

      {/* Grille de cartes */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredCollection.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-12">
            Aucune carte trouvée.
          </div>
        ) : (
          filteredCollection.map((item) => (
            <div 
              key={item.id} 
              className="relative group perspective-1000 cursor-pointer"
              onClick={() => setSelectedCard(item)}
            >
              {item.quantity > 1 && (
                <div className="absolute -top-2 -right-2 z-10 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-gray-900 shadow-lg">
                  x{item.quantity}
                </div>
              )}
              
              <div className="relative aspect-[63/88] w-full rounded-xl overflow-hidden shadow-md transition-transform duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:-translate-y-2 border border-gray-800 group-hover:border-gray-600">
                {item.image ? (
                  <Image
                    src={`${item.image}/high.png`}
                    alt={item.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 20vw"
                    className="object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center p-4 text-center text-sm text-gray-400">
                    Image indisponible
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL */}
      {selectedCard && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedCard(null)}
        >
          <div 
            className="relative flex flex-col md:flex-row bg-[#12121a] border border-[#2a2a40] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedCard(null)}
              className="absolute top-4 right-4 z-10 p-2 text-gray-400 bg-gray-900/80 rounded-full hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="relative w-full md:w-1/2 p-6 flex items-center justify-center bg-black/40">
              <div className="relative w-full max-w-[350px] aspect-[63/88] rounded-xl overflow-hidden shadow-2xl">
                {selectedCard.image ? (
                  <Image
                    src={`${selectedCard.image}/high.png`}
                    alt={selectedCard.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-400">
                    Image indisponible
                  </div>
                )}
              </div>
            </div>

            <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col justify-center overflow-y-auto">
              <h2 className="text-3xl font-bold text-white mb-2">{selectedCard.name}</h2>
            
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-full text-sm font-medium text-gray-300">
                  {selectedCard.rarity || "Standard"}
                </span>
                <span className="px-3 py-1 bg-yellow-900/30 border border-yellow-800 rounded-full text-sm font-medium text-yellow-400 flex items-center gap-1">
                  Valeur : ~₡{getBasePrice(selectedCard.rarity, selectedCard.name, selectedCard.set.id)}
                </span>
              </div>

              <div className="space-y-4 text-gray-300">
                <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-800">
                  <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Set / Extension</p>
                  <p className="font-medium text-white">{selectedCard.set.name}</p>
                </div>

                <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-800">
                  <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Quantité possédée</p>
                  <p className="font-medium text-white text-xl">{selectedCard.quantity} exemplaire(s)</p>
                </div>

                {selectedCard.illustrator && (
                  <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-800">
                    <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Illustrateur</p>
                    <p className="font-medium text-white">{selectedCard.illustrator}</p>
                  </div>
                )}
              </div>

              {!isPublic && (
                <div className="mt-8 pt-6 border-t border-gray-800">
                  <button 
                    onClick={handleSellCard}
                    disabled={isSelling}
                    className="w-full py-3 bg-red-900/30 hover:bg-red-800/50 text-red-400 hover:text-red-300 rounded-lg font-medium transition-colors border border-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSelling 
                      ? "Vente en cours..." 
                      : `Vendre un exemplaire (~₡${getBasePrice(selectedCard.rarity, selectedCard.name, selectedCard.set.id)})`
                    }
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}