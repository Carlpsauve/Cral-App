import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSetDetails, getCardDetails } from "@/lib/tcgdex"; 
import { getLorcanaSetCards } from "@/lib/lorcana";
import { BOOSTER_CONFIG, BoosterSetId } from "@/config/boosters";
import { getMontrealDateString } from '@/lib/slots';
import { RARITY_RATIOS, SPECIAL_CARD_PRICES } from "@/config/cards";

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

    // ✨ NOUVEAU : Récupérer les IDs des cartes que le joueur possède déjà ✨
    const { data: existingCards } = await supabase
      .from("user_cards")
      .select("tcgdex_id")
      .eq("user_id", user.id);
    
    // Set ultra-rapide pour vérifier les doublons
    const ownedIds = new Set((existingCards || []).map(c => c.tcgdex_id));

    const { data: profile } = await supabase.from("profiles").select("balance, role").eq("id", user.id).single();
    
    const maxFreeBoosters = 3;
    const { data: claimedBoosters } = await supabase
      .from('daily_boosters')
      .select('id')
      .eq('user_id', user.id)
      .eq('played_date', today);

    const claimedCount = claimedBoosters?.length || 0;

    const isExcludedFromFree = setId === "sv03.5"; 
    const isFree = claimedCount < maxFreeBoosters && !isExcludedFromFree;
    const finalPrice = isFree ? 0 : config.price;

    if (!isFree && (profile?.balance ?? 0) < finalPrice) {
      return NextResponse.json({ error: "Fonds insuffisants" }, { status: 400 });
    }

    // ==========================================
    // 5. CHARGEMENT DES CARTES SELON LE JEU
    // ==========================================
    let allCardsWithDetails: any[] = [];

    if (config.game === "lorcana") {
      allCardsWithDetails = await getLorcanaSetCards(setId);
      if (allCardsWithDetails.length === 0) {
        return NextResponse.json({ error: "Impossible de charger l'extension Lorcana" }, { status: 500 });
      }
    } else {
      const setDetails = await getSetDetails(setId);
      
      if (!setDetails || !setDetails.cards) {
         return NextResponse.json({ error: "Impossible de charger l'extension Pokémon" }, { status: 500 });
      }

      allCardsWithDetails = await Promise.all(
        setDetails.cards.map(async (card) => {
          const details = await getCardDetails(card.id);
          return details ? details : card; 
        })
      );
    }

    // ==========================================
    // 6. TRI DES RARETÉS SÉPARÉ PAR JEU
    // ==========================================
    const commons: any[] = [];
    const uncommons: any[] = [];
    const rares: any[] = [];
    const superRares: any[] = [];
    const ultraRares: any[] = [];

    allCardsWithDetails.forEach(card => {
      const rarity = ((card as any).rarity || "").toLowerCase();
      
      if (config.game === "lorcana") {
        if (rarity.includes("enchanted")) ultraRares.push(card);
        else if (rarity.includes("legendary")) superRares.push(card);
        else if (rarity.includes("super rare")) rares.push(card); 
        else if (rarity.includes("rare") || rarity.includes("uncommon")) uncommons.push(card); 
        else commons.push(card);
      } else {
        if (rarity.includes("secret") || rarity.includes("illustration") || rarity.includes("vmax") || rarity.includes("rainbow") || rarity.includes("gold")) {
          ultraRares.push(card);
        } else if (rarity.includes("v ") || rarity.includes("vstar") || rarity.includes("ultra")) {
          superRares.push(card);
        } else if (rarity.includes("holo") || rarity.includes("rare")) {
          rares.push(card);
        } else if (rarity.includes("uncommon") || rarity.includes("peu commune")) {
          uncommons.push(card);
        } else {
          commons.push(card);
        }
      }
    });

    const pickRandom = (choices: any[][]) => {
      for (const array of choices) {
        if (array && array.length > 0) return array[Math.floor(Math.random() * array.length)];
      }
      return allCardsWithDetails[Math.floor(Math.random() * allCardsWithDetails.length)];
    };

    const pulledCards = [];

    // ==========================================
    // 🎲 7. GÉNÉRATION DU PAQUET
    // ==========================================

    if (config.game === "lorcana") {
      for (let i = 0; i < 2; i++) {
        const luck = Math.random();
        if (luck < 0.01) pulledCards.push(pickRandom([superRares, rares])); 
        else pulledCards.push(pickRandom([commons, uncommons])); 
      }
      const luck3 = Math.random();
      if (luck3 < 0.01) pulledCards.push(pickRandom([superRares])); 
      else if (luck3 < 0.11) pulledCards.push(pickRandom([rares])); 
      else pulledCards.push(pickRandom([uncommons])); 

      const luck4 = Math.random();
      if (luck4 < 0.01) pulledCards.push(pickRandom([superRares])); 
      else if (luck4 < 0.21) pulledCards.push(pickRandom([rares])); 
      else pulledCards.push(pickRandom([uncommons])); 

      const luck5 = Math.random();
      if (luck5 < 0.025) pulledCards.push(pickRandom([ultraRares])); 
      else if (luck5 < 0.125) pulledCards.push(pickRandom([superRares])); 
      else pulledCards.push(pickRandom([rares, uncommons])); 
    } else {
      for (let i = 0; i < 3; i++) {
        const luck = Math.random();
        if (luck < 0.005) pulledCards.push(pickRandom([ultraRares])); 
        else if (luck < 0.05) pulledCards.push(pickRandom([rares])); 
        else pulledCards.push(pickRandom([commons])); 
      }
      const luck4 = Math.random();
      if (luck4 < 0.05) pulledCards.push(pickRandom([superRares])); 
      else if (luck4 < 0.15) pulledCards.push(pickRandom([rares])); 
      else if (luck4 < 0.95) pulledCards.push(pickRandom([uncommons])); 
      else pulledCards.push(pickRandom([commons])); 

      const luck5 = Math.random();
      if (luck5 < 0.025) pulledCards.push(pickRandom([ultraRares])); 
      else if (luck5 < 0.125) pulledCards.push(pickRandom([superRares])); 
      else if (luck5 < 0.375) pulledCards.push(pickRandom([rares])); 
      else pulledCards.push(pickRandom([uncommons, commons])); 
    }


    // ==========================================
    // 🚨 8. PAIEMENT SÉCURISÉ (ATOMIQUE)
    // ==========================================
    if (isFree) {
      await supabase.from('daily_boosters').insert({ 
        user_id: user.id, 
        played_date: today, 
        booster_set: setId 
      });
    } else {
      const { data: isSuccess, error: rpcError } = await supabase.rpc('deduct_balance', {
        target_user_id: user.id,
        deduct_amount: finalPrice
      });

      if (rpcError) {
        console.error("Erreur RPC lors du paiement:", rpcError);
        return NextResponse.json({ error: "Erreur système lors du paiement." }, { status: 500 });
      }

      if (!isSuccess) {
        return NextResponse.json({ error: "Solde insuffisant (Transaction bloquée)." }, { status: 400 });
      }
    }

    await supabase.from("transactions").insert({
      user_id: user.id,
      amount: -finalPrice,
      type: "shop_booster",
      description: isFree ? `Cadeau du jour (${claimedCount + 1}/${maxFreeBoosters}) : ${config.name}` : `Achat Booster : ${config.name}`
    });

    const calculateCardPrice = (rarity: string = "", name: string = "", setId: string) => {
      const cardName = name.toLowerCase();
      const cardRarity = rarity.toLowerCase();
      const gameType = config.game || "pokemon";

      const specialKey = Object.keys(SPECIAL_CARD_PRICES).find(key => cardName.includes(key));
      if (specialKey) return SPECIAL_CARD_PRICES[specialKey];

      const packPrice = config.price || 20;
      const gameRatios = RARITY_RATIOS[gameType as keyof typeof RARITY_RATIOS];
      
      const ratioKey = Object.keys(gameRatios).find(key => cardRarity.includes(key));
      const ratio = ratioKey ? gameRatios[ratioKey] : 0.05; 
      
      return Math.round((packPrice * ratio) * 10) / 10;
    };

    // ✨ NOUVEAU : Marquage des cartes nouvelles ! ✨
    const finalPulledCards = pulledCards
      .filter(c => c !== undefined && c !== null)
      .map(c => {
        const isNew = !ownedIds.has(c.id);
        if (isNew) ownedIds.add(c.id); // Gestion des doublons dans le même pack
        return { ...c, isNew };
      });

    const cardsToInsert = finalPulledCards.map(c => ({
        user_id: user.id,
        tcgdex_id: c.id,
        price: calculateCardPrice((c as any).rarity, c.name, setId),
        name: c.name,
        image: c.image || null,
        rarity: (c as any).rarity || "Common",
        set_id: c.set?.id || setId,
        set_name: c.set?.name || config.name
      }));

    if (cardsToInsert.length > 0) {
      await supabase.from("user_cards").insert(cardsToInsert);
    }

    // On renvoie les cartes avec le flag "isNew" au client
    return NextResponse.json({ success: true, pulledCards: finalPulledCards, isFree });

  } catch (error) {
    console.error("Erreur serveur Booster:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}