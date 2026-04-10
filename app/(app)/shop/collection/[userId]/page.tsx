import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import CollectionClient, { CollectionItem } from "../CollectionClient";
import { BOOSTER_CONFIG } from "@/config/boosters";
import { getCardsBySet } from "@/lib/tcgdex";
import { getLorcanaSetCards } from "@/lib/lorcana";

export const dynamic = 'force-dynamic';

export default async function PublicCollectionPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ userId: string }>,
  searchParams: Promise<{ set?: string, showMissing?: string }> 
}) {
  const { userId } = await params; 
  const { set: selectedSet, showMissing } = await searchParams;
  
  await cookies();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (user.id === userId) redirect("/shop/collection");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (!profile) return <div className="p-8 text-white">Joueur introuvable.</div>;

  let query = supabase
    .from("user_cards")
    .select("id, tcgdex_id, price, name, image, rarity, set_id, set_name")
    .eq("user_id", userId);

  if (selectedSet) {
    query = query.eq("set_id", selectedSet);
  }

  const { data: userCards, error } = await query;

  if (error) {
    console.error("Erreur DB:", error);
    return <div className="p-8 text-white">Erreur lors du chargement du classeur.</div>;
  }

  let referenceCards: any[] = [];
  if (showMissing === 'true' && selectedSet) {
    try {
      if (selectedSet.startsWith('lorcana-') || ['TFC', 'ROF', 'ITI'].includes(selectedSet)) {
        const lorcanaMapping: Record<string, string> = { 'lorcana-1': 'TFC', 'lorcana-2': 'ROF', 'lorcana-3': 'ITI' };
        const setId = lorcanaMapping[selectedSet] || selectedSet;
        referenceCards = await getLorcanaSetCards(setId);
      } else {
        referenceCards = await getCardsBySet(selectedSet);
      }
    } catch (e) {
      console.error("Erreur chargement set référence:", e);
    }
  }

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
      {/* On peut garder cet en-tête ou le supprimer comme l'info est maintenant dans l'encadré */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <Link 
          href="/classement"
          className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors"
        >
          <Trophy size={20} />
          Retour au classement
        </Link>
      </div>

      <CollectionClient 
        collection={Object.values(groupedCards)} 
        isPublic={true}
        username={profile.username} // ✨ On passe le pseudo ici !
        referenceCards={referenceCards}    
        boosters={Object.entries(BOOSTER_CONFIG)}          
        showMissing={showMissing === 'true'}    
        selectedSet={selectedSet}
      />
    </div>
  );
}