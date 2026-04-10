import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// LE CATALOGUE OFFICIEL DES QUÊTES
const QUEST_CATALOG = [
  { id: 'slots', title: '🎰 Le Dégénéré', desc: 'Jouer {target} spin payant à la machine à sous', min: 1, max: 1 },
  { id: 'bigcral', title: '🎡 La Grosse Roue', desc: 'Miser {target} fois sur Big Cral', min: 1, max: 10 },
  { id: 'sports', title: '🏟️ Le Bookmaker', desc: 'Placer {target} pari(s) sportif(s)', min: 1, max: 3 },
  { id: 'boosters', title: '📦 Le Collectionneur', desc: 'Ouvrir {target} booster(s) dans la boutique', min: 1, max: 3 },
  { id: 'gajure', title: '🤝 Le Parieur Fou', desc: 'Créer ou accepter {target} gajure(s)', min: 1, max: 1 },
  { id: 'blackjack', title: '🃏 Le Flambeur', desc: 'Jouer {target} mains au Blackjack', min: 3, max: 10 },
  { id: 'sugar_cral', title: '🍬 Le Larbin', desc: 'Démarrer {target} tâche(s) pour Sugar Cral', min: 1, max: 3 },
  { id: 'quiz', title: '🧠 L\'Érudit', desc: 'Jouer au Quiz Mort Subite', min: 1, max: 1 }
];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const now = new Date();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    
    const yesterdayDateObj = new Date(now);
    yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1);
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', year: 'numeric', month: '2-digit', day: '2-digit' }).format(yesterdayDateObj);

    // ====================================================================
    // ÉTAPE A : TIRAGE AU SORT DES 3 QUÊTES DU JOUR 🎯
    // ====================================================================
    const { data: globalQuests } = await supabaseAdmin.from('daily_global_quests').select('played_date').eq('played_date', today).maybeSingle();
    
    if (!globalQuests) {
      // 1. Mélanger le catalogue
      const shuffled = [...QUEST_CATALOG].sort(() => 0.5 - Math.random()).slice(0, 3);
      
      // 2. Assigner les cibles aléatoires
      const dailyQuests = shuffled.map(q => {
        const target = Math.floor(Math.random() * (q.max - q.min + 1)) + q.min;
        return { 
          id: q.id, 
          title: q.title, 
          desc: q.desc.replace('{target}', target.toString()), 
          target 
        };
      });

      // 3. Sauvegarder pour tout le serveur
      await supabaseAdmin.from('daily_global_quests').insert({ played_date: today, quests: dailyQuests });
      console.log("[CRON] 3 Quêtes aléatoires générées pour le serveur !");
    }

    // ====================================================================
    // ÉTAPE B : RÉCOMPENSER LE GAGNANT D'HIER (QUIZ) 💰
    // ====================================================================
    const { data: topScores } = await supabaseAdmin.from('quiz_scores').select('user_id, score').eq('played_date', yesterday).order('score', { ascending: false }).limit(1);

    if (topScores && topScores.length > 0 && topScores[0].score > 0) {
      const winnerId = topScores[0].user_id;
      const { data: existingTx } = await supabaseAdmin.from('transactions').select('id').eq('user_id', winnerId).like('description', `%Quiz%${yesterday}%`).maybeSingle();

      if (!existingTx) {
        await supabaseAdmin.from('transactions').insert({
          user_id: winnerId, amount: 50, type: 'quiz_reward',
          description: `Victoire Quiz Mort Subite (${yesterday}) - Score: ${topScores[0].score}`
        });
        const { data: profile } = await supabaseAdmin.from('profiles').select('balance').eq('id', winnerId).single();
        if (profile) await supabaseAdmin.from('profiles').update({ balance: profile.balance + 50 }).eq('id', winnerId);
      }
    }

    // ====================================================================
    // ÉTAPE C : GÉNÉRER LES QUESTIONS DU JOUR AVEC GEMINI 🧠
    // ====================================================================
    const { data: existingQuestions } = await supabaseAdmin.from('daily_quiz').select('id').eq('played_date', today).limit(1);

    if (!existingQuestions || existingQuestions.length === 0) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Génère 30 questions de type "Vrai ou Faux" sur des sujets aléatoires difficiles. Réponds UNIQUEMENT avec un tableau JSON valide. Format attendu : [{"question": "...", "is_true": true, "explanation": "..."}]`;

      const result = await model.generateContent(prompt);
      let responseText = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
      const questionsArray = JSON.parse(responseText);

      const insertData = questionsArray.map((q: any) => ({
        played_date: today, question: q.question, is_true: q.is_true, explanation: q.explanation
      }));

      await supabaseAdmin.from('daily_quiz').insert(insertData);
    }

    return NextResponse.json({ success: true, message: `Routine de minuit terminée avec succès.` });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}