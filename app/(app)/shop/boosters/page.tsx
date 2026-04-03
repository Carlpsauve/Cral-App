"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Sparkles, CheckCircle2, Gift } from "lucide-react";
import { BOOSTER_CONFIG, BoosterSetId } from "@/config/boosters";
import { createClient } from "@/lib/supabase-client";

type Step = 'idle' | 'fetching' | 'opening' | 'revealing' | 'done';

// On définit les boosters exclus ici aussi pour l'affichage
const EXCLUDED_FROM_FREE: string[] = ["mew"];

export default function BoostersPage() {
  const supabase = createClient();
  const [step, setStep] = useState<Step>('idle');
  const [result, setResult] = useState<any[]>([]);
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentBooster, setCurrentBooster] = useState<BoosterSetId | null>(null);
  const [isFreeAvailable, setIsFreeAvailable] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    async function checkFreeStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'America/Montreal' });
      
      const { data } = await supabase
        .from('daily_boosters')
        .select('id')
        .eq('user_id', user.id)
        .eq('played_date', today)
        .maybeSingle();
      
      setIsFreeAvailable(!data);
    }
    checkFreeStatus();
  }, [supabase]);

  const handleBuyBooster = async (setId: BoosterSetId) => {
    setStep('fetching');
    setError(null);
    setCurrentBooster(setId);

    try {
      const res = await fetch("/api/shop/booster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");

      setResult(data.pulledCards);
      setFlipped(new Array(data.pulledCards.length).fill(false));
      
      if (data.isFree) {
        setIsFreeAvailable(false);
      }
      
      router.refresh();
      setStep('opening');
      setTimeout(() => setStep('revealing'), 2000);

    } catch (err: any) {
      setError(err.message);
      setStep('idle');
    }
  };

  const handleFlip = (index: number) => {
    if (step !== 'revealing') return;
    const newFlipped = [...flipped];
    newFlipped[index] = true;
    setFlipped(newFlipped);
    if (newFlipped.every(Boolean)) {
      setTimeout(() => setStep('done'), 1000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 min-h-[80vh] flex flex-col">
      {/* En-tête */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Boutique</h1>
          <p className="text-gray-400">Choisis ton extension et tente ta chance.</p>
        </div>
        
        {isFreeAvailable && step === 'idle' && (
          <div className="bg-green-500/10 border border-green-500/50 px-4 py-2 rounded-full flex items-center gap-2 text-green-400 animate-bounce">
            <Gift size={18} />
            <span className="text-sm font-bold">Booster gratuit disponible !</span>
          </div>
        )}

        <Link href="/shop/collection" className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors">
          <BookOpen size={20} /> Voir ma collection
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg mb-8 text-center">{error}</div>
      )}

      {/* ÉTAPE 1 : Étagère */}
      {(step === 'idle' || step === 'fetching') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
          {Object.entries(BOOSTER_CONFIG).map(([id, config]) => {
            // On vérifie si CE booster spécifique est éligible à la gratuité
            const canBeFree = isFreeAvailable && !EXCLUDED_FROM_FREE.includes(id);

            return (
              <div key={id} className="flex flex-col items-center">
                <div 
                  className={`relative w-64 cursor-pointer transition-transform hover:-translate-y-2 ${step === 'fetching' ? 'opacity-50' : ''}`}
                  onClick={() => handleBuyBooster(id as BoosterSetId)}
                >
                  <img src={config.image} alt={config.name} className="w-full h-full object-contain rounded-xl shadow-2xl" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-white">{config.name}</h3>
                
                <button 
                  onClick={() => handleBuyBooster(id as BoosterSetId)}
                  disabled={step === 'fetching'}
                  className={`mt-4 font-bold py-2 px-10 rounded-full shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                    canBeFree 
                      ? 'bg-green-600 hover:bg-green-500 text-white' 
                      : 'bg-gold-500 hover:bg-gold-400 text-black'
                  }`}
                >
                  {canBeFree && <Gift size={18} />}
                  {step === 'fetching' && currentBooster === id 
                    ? "Paiement..." 
                    : canBeFree 
                      ? "GRATUIT" 
                      : `Acheter ₡${config.price}`
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ÉTAPE 2 : Animation d'ouverture */}
      {step === 'opening' && currentBooster && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative w-64 h-80 animate-shake">
            <img 
              src={BOOSTER_CONFIG[currentBooster].image} 
              alt="Opening" 
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="mt-8 text-2xl font-bold text-gold-400 animate-pulse text-center">
            Ouverture du paquet {BOOSTER_CONFIG[currentBooster].name}...
          </h2>
        </div>
      )}

      {/* ÉTAPE 3 : Révélation */}
      {(step === 'revealing' || step === 'done') && (
        <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-500">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
            <Sparkles className="text-yellow-400" /> Révèle tes cartes !
          </h2>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 w-full max-w-5xl">
            {result.map((card, index) => (
              <div key={index} className="relative w-[140px] md:w-[180px] aspect-[63/88] cursor-pointer group [perspective:1000px]" onClick={() => handleFlip(index)}>
                <div className={`w-full h-full transition-all duration-700 [transform-style:preserve-3d] ${flipped[index] ? '[transform:rotateY(180deg)]' : 'hover:-translate-y-2'}`}>
                  <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] rounded-xl overflow-hidden border-[3px] border-yellow-600/50">
                    <img src="https://upload.wikimedia.org/wikipedia/en/3/3b/Pokemon_Trading_Card_Game_cardback.jpg" alt="Back" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-xl overflow-hidden bg-black shadow-2xl">
                    {card.image ? <Image src={`${card.image}/high.png`} alt={card.name} fill className="object-cover" /> : <div className="p-2 text-xs">{card.name}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {step === 'done' && (
            <div className="mt-12 animate-in slide-in-from-bottom-4">
              <button onClick={() => { setStep('idle'); setResult([]); router.push('/shop/collection'); }} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold text-lg py-4 px-8 rounded-full shadow-lg transition-transform hover:scale-105">
                <CheckCircle2 size={24} /> Ajouter au classeur
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}