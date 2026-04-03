import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getCardDetails } from "@/lib/tcgdex";
import { BOOSTER_CONFIG } from "@/config/boosters";
import { RARITY_RATIOS, SPECIAL_CARD_PRICES } from "@/config/cards";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { cardId, tcgdexId } = body;

    if (!cardId || !tcgdexId) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // 1. Vérifier que la carte t'appartient
    const { data: card, error: cardError } = await supabase
      .from("user_cards")
      .select("id")
      .eq("id", cardId)
      .eq("user_id", user.id)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });
    }

    // 2. Calculer le prix de base
    const cardDetails = await getCardDetails(tcgdexId);
    let basePrice = 1;

    if (cardDetails) {
      const cardName = cardDetails.name.toLowerCase();
      
      // A. Vérifier les exceptions VIP (toujours prioritaires et fixes)
      const specialKey = Object.keys(SPECIAL_CARD_PRICES).find(k => cardName.includes(k));
      
      if (specialKey) {
        basePrice = SPECIAL_CARD_PRICES[specialKey as keyof typeof SPECIAL_CARD_PRICES];
      } 
      // B. Calcul dynamique basé sur le prix du booster
      else {
        // On récupère le prix du booster pour ce SET précis
        const setConfig = BOOSTER_CONFIG[cardDetails.set.id as keyof typeof BOOSTER_CONFIG];
        const packPrice = setConfig?.price || 20; // 20 par défaut si inconnu

        const rarity = cardDetails.rarity?.toLowerCase() || "";
        const ratioKey = Object.keys(RARITY_RATIOS).find(k => rarity.includes(k));
        
        const ratio = ratioKey ? RARITY_RATIOS[ratioKey] : 0.05; // 5% par défaut
        basePrice = packPrice * ratio;
      }
    }

    // 3. Le Randomize de l'offre (+/- 5%)
    // Math.random() * 0.1 donne un chiffre entre 0 et 0.1. On ajoute 0.95 pour avoir un multiplicateur entre 0.95 et 1.05.
    let sellPrice = Math.round(basePrice * (0.95 + Math.random() * 0.10));
    if (sellPrice < 1) sellPrice = 1; // On s'assure que ça vaut au moins 1 Cral$

    // 4. SUPPRIMER la carte (C'est ici que ça bloquait sans la règle SQL)
    const { error: deleteError } = await supabase.from("user_cards").delete().eq("id", cardId);
    
    if (deleteError) {
      console.error("Erreur de suppression:", deleteError);
      return NextResponse.json({ error: "Impossible de retirer la carte." }, { status: 500 });
    }

    // 5. Créditer le compte
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
    const newBalance = Number(profile?.balance || 0) + sellPrice;
    await supabase.from("profiles").update({ balance: newBalance }).eq("id", user.id);

    // 6. Historique de transaction
    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount: sellPrice,
      description: `Vente marché noir : ${cardDetails?.name || tcgdexId}`,
      type: "shop_sell"
    });

    if (txError) {
      console.error("CRITICAL ERROR - Transaction Vente:", txError);
    }

    return NextResponse.json({ success: true, sellPrice });

  } catch (error) {
    console.error("Erreur serveur Vente:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}