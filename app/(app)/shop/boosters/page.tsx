"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Sparkles, CheckCircle2, Gift } from "lucide-react";
import { BOOSTER_CONFIG, BoosterSetId } from "@/config/boosters";
import { createClient } from "@/lib/supabase-client";
import HoloCard from "@/components/ui/HoloCard";

type Step = 'idle' | 'fetching' | 'opening' | 'revealing' | 'done';

const EXCLUDED_FROM_FREE: string[] = ["sv03.5"];

export default function BoostersPage() {
  const supabase = createClient();
  const [step, setStep] = useState<Step>('idle');
  const [result, setResult] = useState<any[]>([]);
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentBooster, setCurrentBooster] = useState<BoosterSetId | null>(null);
  
  const [freeBoostersRemaining, setFreeBoostersRemaining] = useState(0);
  const router = useRouter();
  
  useEffect(() => {
    async function checkFreeStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'America/Montreal' });
      const maxFree = 3;

      const { data: claimedBoosters } = await supabase
        .from('daily_boosters')
        .select('id')
        .eq('user_id', user.id)
        .eq('played_date', today);
      
      const claimedCount = claimedBoosters?.length || 0;
      setFreeBoostersRemaining(Math.max(0, maxFree - claimedCount));
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
      
      fetch('/api/bounties/progress', { method: 'POST', body: JSON.stringify({ type: 'boosters' }) }).catch(e => console.error(e));

      setResult(data.pulledCards);
      setFlipped(new Array(data.pulledCards.length).fill(false));
      
      if (data.isFree) {
        setFreeBoostersRemaining(prev => Math.max(0, prev - 1));
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

  const isFreeAvailable = freeBoostersRemaining > 0;

  // Séparation dynamique des boosters
  const pokemonBoosters = Object.entries(BOOSTER_CONFIG).filter(([_, config]) => config.game === "pokemon");
  const lorcanaBoosters = Object.entries(BOOSTER_CONFIG).filter(([_, config]) => config.game === "lorcana");

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
            <span className="text-sm font-bold">
              {freeBoostersRemaining > 1 ? `${freeBoostersRemaining} boosters gratuits disponibles !` : 'Booster gratuit disponible !'}
            </span>
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
        <div className="space-y-16">
          
          {/* Section Pokémon */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-8 border-b border-gray-800 pb-3 flex items-center gap-3">
              <span className="text-red-500">🔴</span> Pokémon TCG
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
              {pokemonBoosters.map(([id, config]) => {
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
          </section>

          {/* Section Lorcana */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-8 border-b border-gray-800 pb-3 flex items-center gap-3">
              <span className="text-purple-400">✨</span> Disney Lorcana
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
              {lorcanaBoosters.map(([id, config]) => {
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
          </section>

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
              <HoloCard 
                key={index} 
                card={card} 
                isFlipped={flipped[index]} 
                onClick={() => handleFlip(index)} 
                // ✨ LA CORRECTION : On force la taille de la carte ici !
                className="w-[140px] md:w-[180px] lg:w-[220px]" 
              />
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