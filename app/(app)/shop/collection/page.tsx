import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link"; 
import { Store } from "lucide-react"; 
import { createClient } from "@/lib/supabase-server";
import CollectionClient, { CollectionItem } from "./CollectionClient";
import { BOOSTER_CONFIG } from "@/config/boosters";
import { getSetDetails, getCardsBySet } from "@/lib/tcgdex";
import { getLorcanaSetCards } from "@/lib/lorcana";

export const dynamic = 'force-dynamic';

export default async function CollectionPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ set?: string, showMissing?: string }> 
}) {
  const { set: selectedSet, showMissing } = await searchParams;
  await cookies();
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  // 1. Récupérer les cartes possédées (filtrées par set si demandé)
  let query = supabase
    .from("user_cards")
    .select("id, tcgdex_id, price, name, image, rarity, set_id, set_name")
    .eq("user_id", user.id);

  if (selectedSet) {
    query = query.eq("set_id", selectedSet);
  }

  const { data: userCards, error } = await query;

  if (error) {
    console.error("Erreur DB:", error);
    return <div>Erreur lors du chargement de la collection.</div>;
  }

  // 2. Charger les cartes de référence (le set complet) si le mode "Manquantes" est actif
  let referenceCards: any[] = [];
  if (showMissing === 'true' && selectedSet) {
    try {
      if (selectedSet.startsWith('lorcana-') || ['TFC', 'ROF', 'ITI'].includes(selectedSet)) {
        // Mapping Lorcana
        const lorcanaMapping: Record<string, string> = { 'lorcana-1': 'TFC', 'lorcana-2': 'ROF', 'lorcana-3': 'ITI' };
        const setId = lorcanaMapping[selectedSet] || selectedSet;
        referenceCards = await getLorcanaSetCards(setId);
      } else {
        // Pokémon
        referenceCards = await getCardsBySet(selectedSet);
      }
    } catch (e) {
      console.error("Erreur chargement set référence:", e);
    }
  }

  // 3. Grouper les cartes possédées pour le client
  const groupedCards: Record<string, CollectionItem> = {};
  (userCards || []).forEach((card) => {
    if (!groupedCards[card.tcgdex_id]) {
      groupedCards[card.tcgdex_id] = {
        id: card.tcgdex_id,
        name: card.name || "Carte Inconnue",
        image: card.image,
        rarity: card.rarity || "Common",
        set: { id: card.set_id || "unknown", name: card.set_name || "Unknown Set" },
        price: card.price || 0,
        quantity: 0,
        card_ids: [],
      };
    }
    groupedCards[card.tcgdex_id].quantity += 1;
    groupedCards[card.tcgdex_id].card_ids.push(card.id);
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Mon Classeur</h1>
          <p className="text-gray-400">
            Tu possèdes {userCards?.length || 0} cartes {selectedSet ? "dans ce set" : "au total"}.
          </p>
        </div>
        
        <Link 
          href="/shop/boosters"
          className="inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 text-black font-bold py-2.5 px-6 rounded-lg transition-transform hover:scale-105 shadow-lg shadow-gold-500/20"
        >
          <Store size={20} />
          Boutique
        </Link>
      </div>

      <CollectionClient 
        collection={Object.values(groupedCards)} 
        referenceCards={referenceCards}
        boosters={Object.entries(BOOSTER_CONFIG)}
        selectedSet={selectedSet}
        showMissing={showMissing === 'true'}
      />
    </div>
  );
}