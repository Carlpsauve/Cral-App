import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link"; // NOUVEAU
import { Store } from "lucide-react"; // NOUVEAU
import { createClient } from "@/lib/supabase-server";
import CollectionClient, { CollectionItem } from "./CollectionClient";
import { getCardDetails } from "@/lib/tcgdex";

// Force le rendu dynamique pour avoir l'inventaire en temps réel 
export const dynamic = 'force-dynamic';

export default async function CollectionPage() {
  // Await des cookies et du client Next.js 15 
  await cookies();
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect("/login");
  }

  // 1. Récupérer toutes les cartes de l'utilisateur dans la DB
  const { data: userCards, error } = await supabase
    .from("user_cards")
    .select("id, tcgdex_id")
    .eq("user_id", user.id);

  if (error) {
    console.error("Erreur DB:", error);
    return <div>Erreur lors du chargement de la collection.</div>;
  }

  // 2. Grouper les cartes par tcgdex_id pour compter les doublons
  const groupedCards: Record<string, { quantity: number; card_ids: string[] }> = {};
  
  (userCards || []).forEach((card) => {
    if (!groupedCards[card.tcgdex_id]) {
      groupedCards[card.tcgdex_id] = { quantity: 0, card_ids: [] };
    }
    groupedCards[card.tcgdex_id].quantity += 1;
    groupedCards[card.tcgdex_id].card_ids.push(card.id);
  });

  // 3. Récupérer les détails TCGdex uniquement pour les cartes uniques
  const uniqueCardIds = Object.keys(groupedCards);
  
  // Utilise Promise.all pour exécuter les requêtes TCGdex en parallèle
  const cardsDetailsPromises = uniqueCardIds.map(id => getCardDetails(id));
  const cardsDetailsResults = await Promise.all(cardsDetailsPromises);

  // 4. Fusionner les détails de l'API avec les quantités de la DB
  const finalCollection: CollectionItem[] = [];
  
  cardsDetailsResults.forEach((details) => {
    if (details) {
      finalCollection.push({
        ...details,
        quantity: groupedCards[details.id].quantity,
        card_ids: groupedCards[details.id].card_ids,
      });
    }
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Mon Classeur</h1>
          <p className="text-gray-400">
            Tu possèdes {userCards?.length || 0} cartes au total ({finalCollection.length} uniques).
          </p>
        </div>
        
        <Link 
          href="/shop/boosters"
          className="inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 text-black font-bold py-2.5 px-6 rounded-lg transition-transform hover:scale-105 shadow-lg shadow-gold-500/20"
        >
          <Store size={20} />
          Retour à la boutique
        </Link>
      </div>

      <CollectionClient collection={finalCollection} />
    </div>
  );
}