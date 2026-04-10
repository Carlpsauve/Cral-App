import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-server';

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

    const { type } = await request.json(); // ex: 'slots', 'blackjack', 'boosters'
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    // 1. Lire les 3 quêtes actives du serveur
    const { data: globalData } = await supabaseAdmin.from('daily_global_quests').select('quests').eq('played_date', today).maybeSingle();
    if (!globalData) return NextResponse.json({ success: true, message: "Les quêtes du jour ne sont pas encore générées." });
    
    const activeQuests: any[] = globalData.quests;
    
    // Si l'action qu'on vient de faire ne fait pas partie des 3 quêtes du jour, on quitte pour économiser les calculs !
    const isQuestActive = activeQuests.find(q => q.id === type);
    if (!isQuestActive) return NextResponse.json({ success: true, message: "Cette action ne fait pas partie des quêtes aujourd'hui." });

    // 2. Trouver ou créer la progression du joueur
    let { data: bounty } = await supabaseAdmin.from('daily_bounties').select('*').eq('user_id', user.id).eq('played_date', today).maybeSingle();

    if (!bounty) {
      const { data: newBounty } = await supabaseAdmin.from('daily_bounties').insert({ user_id: user.id, played_date: today }).select().single();
      bounty = newBounty;
    }

    if (bounty.is_completed) return NextResponse.json({ success: true, message: "Déjà complété" });

    // 3. Ajouter +1 à la progression du joueur
    const currentValue = bounty[type as keyof typeof bounty] as number;
    const updateData: any = {};
    updateData[type] = currentValue + 1;
    
    // Appliquer localement pour la vérification
    bounty[type] = currentValue + 1;

    // 4. Vérifier si les 3 quêtes du jour sont maintenant terminées
    let completedCount = 0;
    for (const q of activeQuests) {
      if ((bounty[q.id] as number) >= q.target) {
        completedCount++;
      }
    }

    let justCompleted = false;
    if (completedCount >= 3) {
        updateData.is_completed = true;
        justCompleted = true;
    }

    await supabaseAdmin.from('daily_bounties').update(updateData).eq('id', bounty.id);

    // 5. RÉCOMPENSE ! 💰
    if (justCompleted) {
       const { data: profile } = await supabaseAdmin.from('profiles').select('balance').eq('id', user.id).single();
       if (profile) {
         await supabaseAdmin.from('profiles').update({ balance: profile.balance + 30 }).eq('id', user.id);
         await supabaseAdmin.from('transactions').insert({
           user_id: user.id, amount: 30, type: 'bounty_reward', description: 'Quêtes Quotidiennes accomplies'
         });
       }
    }

    return NextResponse.json({ success: true, justCompleted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}