import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getCardDetails } from "@/lib/tcgdex";
import { getLorcanaSetCards } from "@/lib/lorcana";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'super_admin' && profile?.role !== 'cral_slayer') {
       return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // On cherche les cartes qui n'ont pas encore de nom enregistré
    const { data: cardsToFix, error } = await supabaseAdmin
      .from("user_cards")
      .select("tcgdex_id")
      .is('name', null);

    if (error) throw error;
    if (!cardsToFix || cardsToFix.length === 0) return NextResponse.json({ message: "Tout est déjà à jour !" });

    const uniqueIds = Array.from(new Set(cardsToFix.map(c => c.tcgdex_id)));
    const pokemonIds = uniqueIds.filter(id => !id.startsWith("lorcana-"));
    const lorcanaIds = uniqueIds.filter(id => id.startsWith("lorcana-"));

    const visualData: Record<string, any> = {};

    // POKÉMON
    await Promise.all(
      pokemonIds.map(async (id) => {
        const details = await getCardDetails(id);
        if (details) visualData[id] = details;
      })
    );

    // LORCANA
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
      setCards.forEach(c => { if (lorcanaIds.includes(c.id)) visualData[c.id] = c; });
    }

    // MISE À JOUR MASSIVE
    let updatedCount = 0;
    for (const [tcgdexId, data] of Object.entries(visualData)) {
      await supabaseAdmin
        .from('user_cards')
        .update({ 
          name: data.name,
          image: data.image || null,
          rarity: data.rarity || "Common",
          set_id: data.set?.id || "unknown",
          set_name: data.set?.name || "Unknown Set"
        })
        .eq('tcgdex_id', tcgdexId);
      updatedCount++;
    }

    return NextResponse.json({ success: true, message: `Patch visuel terminé : ${updatedCount} modèles mis à jour !` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}