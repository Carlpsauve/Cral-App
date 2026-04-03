import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import CollectionClient, { CollectionItem } from "../CollectionClient";
import { getCardDetails } from "@/lib/tcgdex";

export const dynamic = 'force-dynamic';

export default async function PublicCollectionPage({ params }: { params: Promise<{ userId: string }> }) {
  // Dans Next.js 15, les params doivent être "awaited"
  const { userId } = await params; 
  await cookies();
  const supabase = await createClient();

  // Vérifier l'authentification
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Si le joueur clique sur SON propre lien, on le renvoie vers son espace privé
  if (user.id === userId) redirect("/shop/collection");

  // 1. Récupérer les infos du joueur visité
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (!profile) return <div className="p-8 text-white">Joueur introuvable.</div>;

  // 2. Récupérer ses cartes
  const { data: userCards } = await supabase
    .from("user_cards")
    .select("id, tcgdex_id")
    .eq("user_id", userId);

  // 3. Grouper les cartes (Même logique que ton classeur)
  const groupedCards: Record<string, { quantity: number; card_ids: string[] }> = {};
  (userCards || []).forEach((card) => {
    if (!groupedCards[card.tcgdex_id]) {
      groupedCards[card.tcgdex_id] = { quantity: 0, card_ids: [] };
    }
    groupedCards[card.tcgdex_id].quantity += 1;
    groupedCards[card.tcgdex_id].card_ids.push(card.id);
  });

  const uniqueCardIds = Object.keys(groupedCards);
  const cardsDetailsPromises = uniqueCardIds.map(id => getCardDetails(id));
  const cardsDetailsResults = await Promise.all(cardsDetailsPromises);

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
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <User className="text-gold-500" />
            Classeur de {profile.username}
          </h1>
          <p className="text-gray-400">
            Il possède {userCards?.length || 0} cartes au total ({finalCollection.length} uniques).
          </p>
        </div>

        <Link 
          href="/classement"
          className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors"
        >
          <Trophy size={20} />
          Retour au classement
        </Link>
      </div>

      {/* On passe isPublic={true} pour désactiver le bouton de vente ! */}
      <CollectionClient collection={finalCollection} isPublic={true} />
    </div>
  );
}