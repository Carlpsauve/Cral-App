import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const REWARDS = {
  pilules: { amount: 2, name: "Donner les pilules" },
  polir: { amount: 10, name: "Polir le crâne" },
  ecouter: { amount: 30, name: "Écouter ses histoires" }
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Trouver la tâche terminée
    const { data: task } = await supabase
      .from('idle_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('claimed', false)
      .single();

    if (!task) return NextResponse.json({ error: "Aucune tâche à réclamer" }, { status: 400 });
    
    // Vérifier que le temps est bien écoulé
    if (new Date(task.ends_at).getTime() > Date.now()) {
      return NextResponse.json({ error: "Patience, Sugar Cral n'a pas fini !" }, { status: 400 });
    }

    const rewardInfo = REWARDS[task.task_id as keyof typeof REWARDS];

    // 1. Marquer comme réclamé
    await supabase.from('idle_tasks').update({ claimed: true }).eq('id', task.id);

    // 2. Donner l'argent
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user.id).single();
    const newBalance = (profile?.balance ?? 0) + rewardInfo.amount;
    await supabase.from("profiles").update({ balance: newBalance }).eq("id", user.id);

    // 3. Historique
    await supabase.from("transactions").insert({
      user_id: user.id,
      amount: rewardInfo.amount,
      type: "idle_game",
      description: `Sugar Cral : ${rewardInfo.name}`
    });

    return NextResponse.json({ success: true, reward: rewardInfo.amount });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}