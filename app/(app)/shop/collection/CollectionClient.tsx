"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { X } from "lucide-react"; // Ajout de l'icône pour fermer
import { TCGCardDetails } from "@/lib/tcgdex";

export type CollectionItem = TCGCardDetails & { quantity: number; card_ids: string[] };

export default function CollectionClient({ collection }: { collection: CollectionItem[] }) {
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState("Toutes");
  // Nouvel état pour gérer la carte sélectionnée pour le modal
  const [selectedCard, setSelectedCard] = useState<CollectionItem | null>(null);

  const rarities = ["Toutes", ...Array.from(new Set(collection.map((c) => c.rarity).filter(Boolean)))];

  const filteredCollection = useMemo(() => {
    return collection.filter((item) => {
      const matchName = item.name.toLowerCase().includes(search.toLowerCase());
      const matchRarity = rarityFilter === "Toutes" || item.rarity === rarityFilter;
      return matchName && matchRarity;
    });
  }, [collection, search, rarityFilter]);

  return (
    <div className="space-y-6">
      {/* Barre de filtres */}
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
              className="relative group perspective-1000 cursor-pointer" // Ajout du cursor-pointer
              onClick={() => setSelectedCard(item)} // Ouvre le modal au clic
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

      {/* MODAL (S'affiche uniquement si une carte est sélectionnée) */}
      {selectedCard && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedCard(null)} // Ferme le modal si on clique à côté de la carte
        >
          {/* Conteneur principal du modal */}
          <div 
            className="relative flex flex-col md:flex-row bg-[#12121a] border border-[#2a2a40] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()} // Empêche la fermeture si on clique SUR la fenêtre
          >
            {/* Bouton de fermeture */}
            <button 
              onClick={() => setSelectedCard(null)}
              className="absolute top-4 right-4 z-10 p-2 text-gray-400 bg-gray-900/80 rounded-full hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Zone de l'image en grand (Gauche) */}
            <div className="relative w-full md:w-1/2 p-6 flex items-center justify-center bg-black/40">
              <div className="relative w-full max-w-[350px] aspect-[63/88] rounded-xl overflow-hidden shadow-2xl">
                {selectedCard.image ? (
                  <Image
                    src={`${selectedCard.image}/high.png`}
                    alt={selectedCard.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                    priority // Charge l'image en priorité
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-400">
                    Image indisponible
                  </div>
                )}
              </div>
            </div>

            {/* Zone des détails (Droite) */}
            <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col justify-center overflow-y-auto">
              <h2 className="text-3xl font-bold text-white mb-2">{selectedCard.name}</h2>
              
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-full text-sm font-medium text-gray-300">
                  {selectedCard.rarity || "Standard"}
                </span>
                <span className="px-3 py-1 bg-blue-900/30 border border-blue-800 rounded-full text-sm font-medium text-blue-400">
                  {selectedCard.category}
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

              {/* Préparation pour la phase 6 : Le Recyclage */}
              <div className="mt-8 pt-6 border-t border-gray-800">
                <button className="w-full py-3 bg-gray-800/50 hover:bg-gray-800 text-gray-500 hover:text-gray-300 rounded-lg font-medium transition-colors border border-gray-700 cursor-not-allowed" disabled>
                  Vendre au système (Bientôt disponible)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}