import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createAdminClient } from '@supabase/supabase-js'; // ✨ Le client Admin
import { getCardDetails } from "@/lib/tcgdex";
import { getLorcanaSetCards } from "@/lib/lorcana";
import { RARITY_RATIOS, SPECIAL_CARD_PRICES } from "@/config/cards";
import { BOOSTER_CONFIG } from "@/config/boosters";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // 1. Client standard pour vérifier qui tu es
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Tu dois être connecté." }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'super_admin' && profile?.role !== 'cral_slayer') {
       return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    // ✨ 2. CLIENT ADMIN : Celui-ci a le droit de tout modifier (Ignore le RLS)
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Récupérer les cartes avec le client Admin
    const { data: cardsToFix, error } = await supabaseAdmin
      .from("user_cards")
      .select("tcgdex_id")
      .or('price.eq.0,price.is.null');

    if (error) throw error;
    if (!cardsToFix || cardsToFix.length === 0) {
      return NextResponse.json({ message: "Toutes les cartes ont déjà un prix." });
    }

    const uniqueIds = Array.from(new Set(cardsToFix.map(c => c.tcgdex_id)));
    const pokemonIds = uniqueIds.filter(id => !id.startsWith("lorcana-"));
    const lorcanaIds = uniqueIds.filter(id => id.startsWith("lorcana-"));

    const cardPrices: Record<string, number> = {};

    // 4. TRAITEMENT POKÉMON
    await Promise.all(
      pokemonIds.map(async (id) => {
        const details = await getCardDetails(id);
        if (details) {
          const cardName = details.name.toLowerCase();
          const cardRarity = (details.rarity || "").toLowerCase();
          const setId = details.set?.id;

          const specialKey = Object.keys(SPECIAL_CARD_PRICES).find(key => cardName.includes(key));
          if (specialKey) {
            cardPrices[id] = SPECIAL_CARD_PRICES[specialKey as keyof typeof SPECIAL_CARD_PRICES];
          } else {
            const config = BOOSTER_CONFIG[setId as keyof typeof BOOSTER_CONFIG];
            const packPrice = config?.price || 20;
            const gameRatios = RARITY_RATIOS["pokemon"];
            const ratioKey = Object.keys(gameRatios).find(key => cardRarity.includes(key));
            const ratio = ratioKey ? (gameRatios as any)[ratioKey] : 0.05;
            cardPrices[id] = Math.round((packPrice * ratio) * 10) / 10;
          }
        }
      })
    );

    // 5. TRAITEMENT LORCANA
    const lorcanaSetNums = new Set<string>();
    lorcanaIds.forEach(id => {
      const parts = id.split("-");
      if (parts.length >= 2) lorcanaSetNums.add(parts[1]);
    });

    for (const setNum of Array.from(lorcanaSetNums)) {
      let setId = "TFC";
      if (setNum === "2") setId = "ROF";
      if (setNum === "3") setId = "ITI";
      const setCards = await getLorcanaSetCards(setId);

      setCards.forEach(c => {
        if (lorcanaIds.includes(c.id)) {
          const cardName = c.name.toLowerCase();
          const cardRarity = (c.rarity || "").toLowerCase();

          const specialKey = Object.keys(SPECIAL_CARD_PRICES).find(key => cardName.includes(key));
          if (specialKey) {
            cardPrices[c.id] = SPECIAL_CARD_PRICES[specialKey as keyof typeof SPECIAL_CARD_PRICES];
          } else {
            const config = BOOSTER_CONFIG[setId as keyof typeof BOOSTER_CONFIG];
            const packPrice = config?.price || 25; 
            const gameRatios = RARITY_RATIOS["lorcana"];
            const ratioKey = Object.keys(gameRatios).find(key => cardRarity.includes(key));
            const ratio = ratioKey ? (gameRatios as any)[ratioKey] : 0.05;
            cardPrices[c.id] = Math.round((packPrice * ratio) * 10) / 10;
          }
        }
      });
    }

    // 6. MISE À JOUR DE SUPABASE AVEC LE CLIENT ADMIN ⚡
    let updatedUniqueCardsCount = 0;
    
    for (const [tcgdexId, price] of Object.entries(cardPrices)) {
      // Le client Admin force l'écriture dans la base de données
      await supabaseAdmin
        .from('user_cards')
        .update({ price: price })
        .eq('tcgdex_id', tcgdexId);
        
      updatedUniqueCardsCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Patch FORCÉ terminé avec succès 🚀 ! ${updatedUniqueCardsCount} modèles de cartes ont été inscrits dans la base de données.` 
    });

  } catch (error: any) {
    console.error("Erreur Patch:", error);
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 });
  }
}