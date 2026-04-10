"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-client";
import { Trophy, Check, X, BrainCircuit, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";

// ✨ IMPORT DES TITRES ✨
import { TITLES_CONFIG } from "@/config/titles";

type GameState = 'loading' | 'intro' | 'playing' | 'gameover' | 'already_played' | 'no_questions';

export default function QuizPage() {
  const supabase = createClient();
  const [gameState, setGameState] = useState<GameState>('loading');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  useEffect(() => {
    async function initGame() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserProfile(user);

      fetchLeaderboard();

      const { data: myScore } = await supabase
        .from('quiz_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('played_date', today)
        .maybeSingle();

      if (myScore) {
        setScore(myScore.score);
        setGameState('already_played');
        return;
      }

      const { data: todaysQuestions } = await supabase
        .from('daily_quiz')
        .select('*')
        .eq('played_date', today);

      if (!todaysQuestions || todaysQuestions.length === 0) {
        setGameState('no_questions');
      } else {
        const shuffled = todaysQuestions.sort(() => 0.5 - Math.random());
        setQuestions(shuffled);
        setGameState('intro');
      }
    }
    initGame();
  }, [supabase]);

  const fetchLeaderboard = async () => {
    // ✨ On ajoute active_title dans la requête
    const { data } = await supabase
      .from('quiz_scores')
      .select('score, profiles(username, avatar_color, avatar_svg, role, active_title)')
      .eq('played_date', today)
      .order('score', { ascending: false })
      .limit(10);
    
    if (data) setLeaderboard(data);
  };

  const handleAnswer = async (answer: boolean) => {
    const currentQ = questions[currentIdx];
    
    if (answer === currentQ.is_true) {
      const newScore = score + 1;
      setScore(newScore);
      
      if (currentIdx + 1 < questions.length) {
        setCurrentIdx(currentIdx + 1);
      } else {
        await saveScore(newScore);
        setExplanation("Incroyable ! Tu as survécu à toutes les questions d'aujourd'hui !");
        setGameState('gameover');
      }
    } else {
      await saveScore(score);
      setExplanation(currentQ.explanation || `C'était ${currentQ.is_true ? 'VRAI' : 'FAUX'}.`);
      setGameState('gameover');
    }
  };

  const saveScore = async (finalScore: number) => {
    if (!userProfile) return;
    
    await supabase.from('quiz_scores').insert({
      user_id: userProfile.id,
      played_date: today,
      score: finalScore
    });
    
    await fetchLeaderboard();
    fetch('/api/bounties/progress', { method: 'POST', body: JSON.stringify({ type: 'quiz' }) }).catch(e => console.error(e));
  };

  if (gameState === 'loading') {
    return <div className="min-h-[60vh] flex items-center justify-center text-gold-500 font-bold animate-pulse">Chargement du quiz...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
            <BrainCircuit className="text-gold-400" size={32} />
            Quiz Mort Subite
          </h1>
          <p className="text-gray-400 mt-1">1 erreur = Élimination. Le gagnant du jour remporte 50 ₡ à minuit.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-cral-sub uppercase tracking-widest mb-1">Score actuel</div>
          <div className="text-4xl font-black text-gold-400">{score}</div>
        </div>
      </div>

      {/* ZONE DE JEU */}
      {gameState === 'intro' && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center max-w-2xl mx-auto shadow-2xl">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(251,191,36,0.1)]">
            <BrainCircuit size={40} className="text-gold-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Prêt pour le défi ?</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Tu vas devoir répondre par VRAI ou FAUX à des questions de culture générale.
            <br/><span className="text-red-400 font-bold">À la première erreur, ta partie est terminée.</span>
          </p>
          <button 
            onClick={() => setGameState('playing')}
            className="bg-gold-500 hover:bg-gold-400 text-black font-black text-xl py-4 px-12 rounded-full transition-transform hover:scale-105 shadow-lg shadow-gold-500/20"
          >
            COMMENCER
          </button>
        </div>
      )}

      {gameState === 'no_questions' && (
        <div className="text-center p-12 bg-gray-900/50 rounded-2xl border border-gray-800">
          <AlertCircle size={48} className="text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl text-white font-bold mb-2">Pas de questions aujourd'hui</h2>
          <p className="text-gray-400">Le robot de Sugar Cral dort encore. Reviens plus tard !</p>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
          <div className="text-center mb-4 text-sm font-bold text-gray-500 uppercase tracking-widest">
            Question {currentIdx + 1}
          </div>
          
          <div className="bg-[#12121a] border border-gray-700 rounded-2xl p-8 md:p-12 text-center shadow-2xl mb-8 min-h-[250px] flex items-center justify-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug">
              {questions[currentIdx].question}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => handleAnswer(true)}
              className="group relative overflow-hidden bg-green-900/20 border-2 border-green-600 hover:bg-green-600 text-green-400 hover:text-white py-6 rounded-2xl font-black text-2xl transition-all active:scale-95"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Check size={28} /> VRAI
              </span>
            </button>
            <button 
              onClick={() => handleAnswer(false)}
              className="group relative overflow-hidden bg-red-900/20 border-2 border-red-600 hover:bg-red-600 text-red-400 hover:text-white py-6 rounded-2xl font-black text-2xl transition-all active:scale-95"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <X size={28} /> FAUX
              </span>
            </button>
          </div>
        </div>
      )}

      {(gameState === 'gameover' || gameState === 'already_played') && (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
          
          <div className={`p-8 rounded-2xl border text-center ${gameState === 'gameover' ? 'bg-red-900/10 border-red-900/50' : 'bg-gray-900/50 border-gray-800'}`}>
            <h2 className="text-3xl font-black text-white mb-2">
              {gameState === 'gameover' ? "☠️ Fin de la partie !" : "Tu as déjà joué aujourd'hui"}
            </h2>
            <div className="text-gray-400 mb-6">Ton score final pour le classement : <span className="text-white font-bold text-xl">{score}</span></div>
            
            {explanation && (
              <div className="bg-[#12121a] p-6 rounded-xl border border-gray-800 text-left">
                <div className="text-xs text-cral-sub uppercase tracking-widest mb-2 flex items-center gap-2">
                  <BrainCircuit size={14}/> Explication de l'IA
                </div>
                <p className="text-gray-300 leading-relaxed">{explanation}</p>
              </div>
            )}
            
            <Link href="/jeux" className="inline-flex items-center gap-2 mt-8 text-gold-400 hover:text-gold-300 font-bold">
              Retour aux jeux <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      )}

      {/* LEADERBOARD */}
      {(gameState === 'gameover' || gameState === 'already_played') && (
        <div className="max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="text-gold-400" /> Classement d'aujourd'hui
          </h3>
          
          <div className="bg-gray-900/30 rounded-2xl border border-gray-800 overflow-hidden">
            {leaderboard.length === 0 ? (
              <div className="p-6 text-center text-gray-500">Aucun score pour le moment.</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {leaderboard.map((entry, idx) => {
                  const isTop = idx === 0;
                  
                  // ✨ Détermination de la configuration du titre du joueur dans le leaderboard
                  const activeTitleKey = entry.profiles?.active_title || (entry.profiles?.role && TITLES_CONFIG[entry.profiles.role] ? entry.profiles.role : null);
                  const activeConfig = activeTitleKey ? TITLES_CONFIG[activeTitleKey] : null;
                  
                  return (
                    <div key={idx} className={`p-4 flex items-center justify-between ${isTop ? 'bg-gold-500/10' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-8 text-center font-bold ${isTop ? 'text-gold-400 text-xl' : 'text-gray-500'}`}>
                          {isTop ? '🏆' : `#${idx + 1}`}
                        </div>
                        
                        {/* ✨ Cadre de l'avatar dynamique ✨ */}
                        <div className={activeConfig ? activeConfig.sidebarRing : ''}>
                          <div className={activeConfig ? 'bg-[#12121a] rounded-full p-[1px]' : ''}>
                            <Avatar 
                              username={entry.profiles?.username || 'Anonyme'} 
                              avatarColor={entry.profiles?.avatar_color} 
                              avatarSvg={entry.profiles?.avatar_svg} 
                              size={32} 
                            />
                          </div>
                        </div>

                        {/* ✨ Couleur du nom dynamique ✨ */}
                        <span className={`font-medium ${activeConfig ? activeConfig.textClass : 'text-gray-300'}`}>
                          {entry.profiles?.username || 'Joueur inconnu'}
                        </span>
                      </div>
                      
                      <div className="font-mono font-bold text-white bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                        {entry.score} pts
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-center text-xs text-gray-500 mt-4">Le 1er à minuit remporte 50 ₡ automatiquement.</p>
        </div>
      )}

    </div>
  );
}