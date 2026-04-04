import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const TASKS_DURATION = {
  pilules: 1, // 1 minute
  polir: 15,  // 15 minutes
  ecouter: 240 // 4 heures (240 minutes)
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { taskId } = await req.json();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Vérifier si une tâche est déjà en cours
    const { data: activeTask } = await supabase
      .from('idle_tasks')
      .select('id')
      .eq('user_id', user.id)
      .eq('claimed', false)
      .single();

    if (activeTask) return NextResponse.json({ error: "Tâche déjà en cours" }, { status: 400 });

    // Calculer la fin
    const durationMinutes = TASKS_DURATION[taskId as keyof typeof TASKS_DURATION];
    const endsAt = new Date(Date.now() + durationMinutes * 60000).toISOString();

    await supabase.from('idle_tasks').insert({
      user_id: user.id,
      task_id: taskId,
      ends_at: endsAt
    });

    return NextResponse.json({ success: true, endsAt });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}