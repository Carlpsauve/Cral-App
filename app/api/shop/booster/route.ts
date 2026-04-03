import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSetDetails } from "@/lib/tcgdex";
import { BOOSTER_CONFIG, BoosterSetId } from "@/config/boosters";
import { getMontrealDateString } from '@/lib/slots';

const CARDS_PER_PACK = 5;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { setId } = await req.json() as { setId: BoosterSetId };
    const today = getMontrealDateString();

    const config = BOOSTER_CONFIG[setId];
    if (!config) return NextResponse.json({ error: "Set invalide" }, { status: 400 });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // 1. Vérifier si le cadeau a déjà été réclamé AUJOURD'HUI
    const { data: alreadyClaimed } = await supabase
      .from('daily_boosters')
      .select('id')
      .eq('user_id', user.id)
      .eq('played_date', today)
      .maybeSingle();

    // --- LOGIQUE D'EXCLUSION ---
    // On définit les sets qui ne peuvent JAMAIS être gratuits
    const isExcludedFromFree = setId === "mew"; 

    // Un booster est gratuit seulement s'il n'a pas été réclamé ET qu'il n'est pas exclu
    const isFree = !alreadyClaimed && !isExcludedFromFree;
    // ---------------------------

    const finalPrice = isFree ? 0 : config.price;

    // 2. Vérifier le solde si ce n'est pas gratuit
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
    
    if (!isFree && (profile?.balance ?? 0) < finalPrice) {
      return NextResponse.json({ error: "Fonds insuffisants" }, { status: 400 });
    }

    // 3. Tirage des cartes (TCGdex)
    const setDetails = await getSetDetails(setId);
    const pulledCards = [];
    for (let i = 0; i < CARDS_PER_PACK; i++) {
      const randomIndex = Math.floor(Math.random() * (setDetails?.cards.length || 1));
      pulledCards.push(setDetails?.cards[randomIndex]);
    }

    // 4. Exécution de la transaction
    if (isFree) {
      await supabase.from('daily_boosters').insert({ 
        user_id: user.id, 
        played_date: today, 
        booster_set: setId 
      });
    }

    // Mise à jour solde
    const newBalance = (profile?.balance ?? 0) - finalPrice;
    await supabase.from("profiles").update({ balance: newBalance }).eq("id", user.id);

    // Historique
    await supabase.from("transactions").insert({
      user_id: user.id,
      amount: -finalPrice,
      type: "shop_booster",
      description: isFree ? `Cadeau du jour : ${config.name}` : `Achat Booster : ${config.name}`
    });

    // Inventaire
    const cardsToInsert = pulledCards
      .filter(c => c !== undefined && c !== null)
      .map(c => ({
        user_id: user.id,
        tcgdex_id: c.id 
      }));

    if (cardsToInsert.length > 0) {
      await supabase.from("user_cards").insert(cardsToInsert);
    }

    return NextResponse.json({ success: true, pulledCards, isFree });

  } catch (error) {
    console.error("Erreur serveur Booster:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}