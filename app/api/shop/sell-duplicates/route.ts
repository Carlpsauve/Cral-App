import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // 1. Récupérer TOUTES les cartes (avec le prix déjà calculé par Supabase !) ⚡
    const { data: userCards, error: fetchError } = await supabase
      .from("user_cards")
      .select("id, tcgdex_id, price")
      .eq("user_id", user.id);

    if (fetchError || !userCards) {
      return NextResponse.json({ error: "Erreur lors du chargement de l'inventaire." }, { status: 500 });
    }

    // 2. Identifier les doublons (On garde 1 exemplaire de chaque tcgdex_id)
    const cardsToKeep = new Set<string>(); // Stocke les tcgdex_id qu'on a déjà vus
    const idsToDelete: string[] = [];      // Les uuid de la DB à supprimer
    let totalSellValue = 0;                // Le pactole final

    userCards.forEach(card => {
      if (cardsToKeep.has(card.tcgdex_id)) {
        // C'est un doublon ! On le prépare pour la vente.
        idsToDelete.push(card.id);
        
        // Randomize de l'offre (+/- 5%) pour chaque carte (comme un vrai marché)
        const basePrice = card.price || 1;
        let cardSellPrice = Math.round(basePrice * (0.95 + Math.random() * 0.10));
        if (cardSellPrice < 1) cardSellPrice = 1;
        
        totalSellValue += cardSellPrice;
      } else {
        // C'est le premier exemplaire, on le garde jalousement.
        cardsToKeep.add(card.tcgdex_id);
      }
    });

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: "Tu n'as aucun doublon à vendre." }, { status: 400 });
    }

    // 3. SUPPRIMER les cartes en lot
    const { error: deleteError } = await supabase
      .from("user_cards")
      .delete()
      .in("id", idsToDelete);
    
    if (deleteError) {
      console.error("Erreur de suppression de masse:", deleteError);
      return NextResponse.json({ error: "Impossible de supprimer les cartes." }, { status: 500 });
    }

    // 4. Créditer le compte du pactole
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
    const newBalance = Number(profile?.balance || 0) + totalSellValue;
    await supabase.from("profiles").update({ balance: newBalance }).eq("id", user.id);

    // 5. Historique de transaction global
    await supabase.from("transactions").insert({
      user_id: user.id,
      amount: totalSellValue,
      description: `Vente de masse : ${idsToDelete.length} doublons vendus`,
      type: "shop_sell"
    });

    return NextResponse.json({ 
      success: true, 
      sellPrice: totalSellValue, 
      cardsSold: idsToDelete.length 
    });

  } catch (error) {
    console.error("Erreur serveur Vente de masse:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}