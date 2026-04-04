"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { HandHeart, Ear, Pill, Coins, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase-client";

// Configuration des tâches (durée en millisecondes pour l'affichage)
const TASKS = {
  pilules: { id: 'pilules', name: "Donner ses pilules", duration: 60 * 1000, durationLabel: "1 min", reward: 2, icon: Pill, color: "text-red-400" },
  polir: { id: 'polir', name: "Polir son crâne chauve", duration: 15 * 60 * 1000, durationLabel: "15 min", reward: 15, icon: HandHeart, color: "text-amber-200" },
  ecouter: { id: 'ecouter', name: "Écouter ses histoires", duration: 8 * 60 * 60 * 1000, durationLabel: "8 heures", reward: 100, icon: Ear, color: "text-blue-400" }
};

// --- ÉTATS D'ANIMATION ARCADE ---
// Les images alternatives doivent être pré-générées et placées dans /public/
const ARCADE_IMAGES = {
  idle: "/sugar-cral-arcade-idle.jpg",   // image_14.png (sans frottement, bouche fermée)
  pills: "/sugar-cral-arcade-pills.jpg", // Bouche qui parle doucement, bulle de médicaments
  polish: "/sugar-cral-arcade-polish.jpg", // Frottement vigorously, sourire excessive, bulle d'étoiles
  stories: "/sugar-cral-arcade-stories.jpg" // Bouche qui raconte, bulle de narration
};

export default function SugarCralPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- ÉTAT POUR L'ANIMATION ARCADE ---
  const [currentArcadeImage, setCurrentArcadeImage] = useState(ARCADE_IMAGES.idle);
  
  // --- ÉTAT POUR LA NOTIFICATION ÉLÉGANTE ---
  const [notification, setNotification] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  // Fonction pour afficher un message Toast qui disparaît tout seul
  const showNotification = (text: string, type: 'success' | 'error') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000); // Disparaît après 3 secondes
  };

  // 1. Charger la tâche en cours au démarrage de la page
  useEffect(() => {
    async function fetchActiveTask() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: task } = await supabase
        .from('idle_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('claimed', false)
        .maybeSingle();

      if (task) {
        setActiveTask(task.task_id);
        setEndTime(new Date(task.ends_at).getTime());
        // Mettre à jour l'animation d'arcade en fonction de la tâche
        setCurrentArcadeImage(ARCADE_IMAGES[task.task_id as keyof typeof ARCADE_IMAGES] || ARCADE_IMAGES.idle);
      }
      setIsLoading(false);
    }
    fetchActiveTask();
  }, [supabase]);

  // 2. Gérer le chronomètre visuel
  useEffect(() => {
    if (!endTime) {
      setTimeLeft(0);
      return;
    }

    // Mise à jour immédiate
    setTimeLeft(Math.max(0, endTime - Date.now()));

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        // Revenir à l'animation idle quand c'est fini
        setCurrentArcadeImage(ARCADE_IMAGES.idle);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  // 3. Lancer une nouvelle tâche via l'API
  const startTask = async (taskId: string) => {
    try {
      // Optimisation UI : On met l'état temporairement le temps que le serveur réponde
      setActiveTask(taskId); 
      // Mettre à jour l'animation d'arcade
      setCurrentArcadeImage(ARCADE_IMAGES[taskId as keyof typeof ARCADE_IMAGES]);
      
      const res = await fetch("/api/idle/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // On met à jour avec l'heure exacte calculée par le serveur
      setEndTime(new Date(data.endsAt).getTime());

    } catch (error: any) {
      // Remplacer l'alerte par la notification élégante
      showNotification(error.message || "Erreur de connexion avec le manoir.", "error");
      setActiveTask(null);
      setCurrentArcadeImage(ARCADE_IMAGES.idle);
    }
  };

  // 4. Réclamer l'argent via l'API
  const claimReward = async () => {
    if (!activeTask || isClaiming) return;
    setIsClaiming(true);

    try {
      const res = await fetch("/api/idle/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Réinitialiser le jeu localement
      setActiveTask(null);
      setEndTime(null);
      setTimeLeft(0);
      setCurrentArcadeImage(ARCADE_IMAGES.idle);
      
      // Rafraîchir pour mettre à jour le solde dans la navigation
      router.refresh(); 
      
      // NOUVEAU : On utilise la notification Toast élégante
      showNotification(`Sugar Cral est satisfait ! Tu as reçu +${data.reward} ₡`, "success");

    } catch (error: any) {
      // Remplacer l'alerte par la notification élégante
      showNotification(error.message || "Sugar Cral s'est endormi avant de payer...", "error");
    } finally {
      setIsClaiming(false);
    }
  };

  // Formater le temps restant (HH:MM:SS ou MM:SS)
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return <div className="min-h-[80vh] flex items-center justify-center text-gold-500 font-bold">Chargement du manoir...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 min-h-[80vh] flex flex-col items-center relative">
      
      {/* NOUVEAU : Le composant de notification flottant (Toast) */}
      {notification && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold shadow-2xl animate-in fade-in slide-in-from-bottom-5 z-50 flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {notification.type === 'success' ? <Coins size={18} /> : <span>⚠️</span>}
          {notification.text}
        </div>
      )}

      {/* En-tête / Personnage avec ton image ARCADE */}
      <div className="w-full text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
        
        {/* NOUVELLE IMAGE INTÉGRÉE ICI 👇 */}
        <div className="relative w-[600px] max-w-full aspect-[4/3] sm:aspect-video mx-auto mb-8 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(251,191,36,0.2)] border-2 border-gold-900/50 relative">
          <Image 
            src={currentArcadeImage} // Utiliser l'image d'animation d'arcade dynamique
            alt="Sugar Cral dans son manoir" 
            fill 
            className="object-contain"
            priority
          />
        </div>

        <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">Sugar Cral</h1>
        <p className="text-gray-400 max-w-lg mx-auto italic">
          "Fais ce que je te dis, gamin, et je te donnerai de quoi t'acheter tes petits cartons colorés."
        </p>
      </div>

      {/* Liste des tâches */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
        {Object.values(TASKS).map((task) => {
          const isActive = activeTask === task.id;
          const isDone = isActive && timeLeft === 0;
          const isBusy = activeTask !== null && activeTask !== task.id;
          const Icon = task.icon;

          return (
            <div 
              key={task.id} 
              className={`relative flex flex-col items-center p-6 rounded-2xl border transition-all duration-300 ${
                isActive 
                  ? 'bg-gray-800/90 border-gold-500 shadow-[0_0_20px_rgba(251,191,36,0.15)]' 
                  : isBusy 
                    ? 'bg-gray-900/40 border-gray-800 opacity-50 grayscale'
                    : 'bg-gray-900 border-gray-700 hover:border-gray-500 hover:bg-gray-800 hover:-translate-y-1'
              }`}
            >
              <Icon size={40} className={`${task.color} mb-4`} />
              <h3 className="text-lg font-bold text-white text-center mb-1">{task.name}</h3>
              <p className="text-gold-400 font-mono font-bold flex items-center gap-1 mb-6">
                <Coins size={14} /> +{task.reward} ₡
              </p>

              {/* Zone du bouton / chronomètre */}
              <div className="w-full mt-auto">
                {isActive ? (
                  isDone ? (
                    <button 
                      onClick={claimReward}
                      disabled={isClaiming}
                      className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold animate-pulse shadow-[0_0_15px_rgba(22,163,74,0.5)] transition-all"
                    >
                      {isClaiming ? "Récupération..." : "Récupérer l'argent !"}
                    </button>
                  ) : (
                    <div className="w-full text-center">
                      <div className="text-2xl font-mono text-white mb-2 tracking-wider">{formatTime(timeLeft)}</div>
                      <div className="w-full bg-gray-700 h-2.5 rounded-full overflow-hidden border border-gray-600">
                        <div 
                          className="bg-gradient-to-r from-gold-600 to-gold-400 h-full transition-all duration-1000 ease-linear"
                          style={{ width: `${100 - (timeLeft / task.duration) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <button 
                    onClick={() => startTask(task.id)}
                    disabled={isBusy}
                    className="w-full py-3 bg-gray-800 border border-gray-600 hover:bg-gray-700 hover:border-gray-400 text-white rounded-xl font-medium transition-all disabled:cursor-not-allowed"
                  >
                    Commencer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}