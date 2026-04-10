import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { cardId } = body;

    if (!cardId) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // ⚡ 1. Récupérer la carte ET son prix déjà calculé par Supabase !
    const { data: card, error: cardError } = await supabase
      .from("user_cards")
      .select("id, price, name, tcgdex_id")
      .eq("id", cardId)
      .eq("user_id", user.id)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: "Carte introuvable." }, { status: 404 });
    }

    // 2. Le Randomize de l'offre (+/- 5%) basé sur le prix exact de la base de données
    const basePrice = card.price || 1;
    let sellPrice = Math.round(basePrice * (0.95 + Math.random() * 0.10));
    if (sellPrice < 1) sellPrice = 1; // On s'assure que ça vaut au moins 1 Cral$

    // 3. SUPPRIMER la carte
    const { error: deleteError } = await supabase.from("user_cards").delete().eq("id", cardId);
    
    if (deleteError) {
      console.error("Erreur de suppression:", deleteError);
      return NextResponse.json({ error: "Impossible de retirer la carte." }, { status: 500 });
    }

    // 4. Créditer le compte
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
    const newBalance = Number(profile?.balance || 0) + sellPrice;
    await supabase.from("profiles").update({ balance: newBalance }).eq("id", user.id);

    // 5. Historique de transaction
    const cardDisplayName = card.name || card.tcgdex_id || "Carte inconnue";
    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      amount: sellPrice,
      description: `Vente marché noir : ${cardDisplayName}`,
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