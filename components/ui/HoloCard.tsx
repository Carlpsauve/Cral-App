'use client';

import { useRef, MouseEvent, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface HoloCardProps {
  card: any;
  isFlipped: boolean;
  onClick?: () => void;
  className?: string;
  isStatic?: boolean; 
}

const getHoloConfig = (rarity: string = '') => {
  const r = rarity.toLowerCase();
  if (!r || r === 'common' || r === 'uncommon' || (r.includes('rare') && !r.includes('holo') && !r.includes('v') && !r.includes('secret') && !r.includes('super rare'))) {
    return { hasFoil: false, foilBackground: 'none', blendMode: 'normal' as any, opacity: 0 };
  }
  if (r.includes('secret') || r.includes('rainbow') || r.includes('enchanted')) {
    return { hasFoil: true, foilBackground: `linear-gradient(115deg, transparent 20%, rgba(255,0,0,0.7) 30%, rgba(255,255,0,0.7) 40%, rgba(0,255,0,0.7) 50%, rgba(0,255,255,0.7) 60%, rgba(0,0,255,0.7) 70%, transparent 80%)`, blendMode: 'color-dodge' as any, opacity: 0.8, size: '200% 200%' };
  }
  if (r.includes('vmax') || r.includes('vstar') || r.includes('ultra') || r.includes('legendary')) {
    return { hasFoil: true, foilBackground: `linear-gradient(135deg, rgba(255,0,128,0.5) 0%, rgba(0,200,255,0.5) 50%, rgba(200,255,0,0.5) 100%)`, blendMode: 'color-dodge' as any, opacity: 0.6, size: '150% 150%' };
  }
  return { hasFoil: true, foilBackground: `linear-gradient(105deg, transparent 20%, rgba(255,215,0,0.5) 25%, rgba(255,0,150,0.5) 50%, rgba(0,200,255,0.5) 75%, transparent 80%)`, blendMode: 'color-dodge' as any, opacity: 0.5, size: '250% 250%' };
};

export default function HoloCard({ card, isFlipped, onClick, className = "w-full", isStatic = false }: HoloCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const foilRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  const rarityInfo = card?.rarity || "";
  const holoConfig = getHoloConfig(rarityInfo);
  const isLorcana = card?.image?.includes('lorcana-api.com') || card?.id?.includes('lorcana') || card?.tcgdex_id?.includes('lorcana') || card?.image?.includes('lorcast.io');

  if (isStatic) {
    return (
      <div className={`relative aspect-[63/88] rounded-xl overflow-hidden shadow-lg border border-gray-800 ${className}`} onClick={onClick}>
        {card.image ? (
          <Image 
            src={isLorcana ? card.image : (card.image.endsWith('.png') || card.image.endsWith('.webp') ? card.image : `${card.image}/low.png`)}
            alt={card.name} 
            fill 
            sizes="(max-width: 768px) 140px, 200px"
            className="object-cover" 
          />
        ) : (
          <div className="p-4 text-white text-center flex items-center justify-center h-full bg-gray-800 text-xs font-bold">{card.name}</div>
        )}
      </div>
    );
  }

  const applyTransforms = useCallback((tiltX: number, tiltY: number, px: number, py: number, isHovered: boolean) => {
    if (!isFlipped) return;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (innerRef.current) {
        innerRef.current.style.transform = `rotateY(${180 + tiltY}deg) rotateX(${tiltX}deg)`;
      }
      if (glareRef.current) {
        glareRef.current.style.opacity = isHovered ? '0.6' : '0';
        glareRef.current.style.background = `radial-gradient(farthest-corner circle at ${px}% ${py}%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 60%)`;
      }
      if (foilRef.current) {
        foilRef.current.style.opacity = isHovered ? holoConfig.opacity.toString() : '0';
        foilRef.current.style.backgroundPosition = `${px}% ${py}%`;
      }
    });
  }, [isFlipped, holoConfig.opacity]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isFlipped || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = (x / rect.width) * 100;
    const py = (y / rect.height) * 100;
    const tiltX = ((rect.height / 2 - y) / (rect.height / 2)) * 15;
    const tiltY = ((x - rect.width / 2) / (rect.width / 2)) * 15;
    applyTransforms(tiltX, tiltY, px, py, true);
  };

  const handleMouseLeave = () => {
    applyTransforms(0, 0, 50, 50, false);
  };

  return (
    <div
      ref={cardRef}
      className={`relative aspect-[63/88] group [perspective:1000px] ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={innerRef}
        className="w-full h-full transition-all duration-500 ease-out shadow-2xl rounded-xl [transform-style:preserve-3d]"
        style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* ==========================================
            DOS DE LA CARTE 
        ========================================== */}
        <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] rounded-xl overflow-hidden border-[3px] border-yellow-600/50 bg-[#0e1630] z-20">
          <img src={isLorcana ? "/lorcana-back.png" : "https://upload.wikimedia.org/wikipedia/en/3/3b/Pokemon_Trading_Card_Game_cardback.jpg"} alt="Back" className="w-full h-full object-cover" />
        </div>

        {/* ==========================================
            FACE DE LA CARTE 
        ========================================== */}
        <div 
          className="absolute inset-0 w-full h-full rounded-xl bg-black" 
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* CONTENEUR DE L'IMAGE (z-10, masque ce qui dépasse) */}
          <div className="absolute inset-0 z-10 rounded-xl overflow-hidden">
            {card.image ? (
              <Image 
                src={isLorcana ? card.image : (card.image.endsWith('.png') || card.image.endsWith('.webp') ? card.image : `${card.image}/low.png`)} 
                alt={card.name} 
                fill 
                sizes="(max-width: 768px) 140px, 200px" 
                className="object-cover" 
              />
            ) : (
              <div className="p-4 text-white text-center flex items-center h-full bg-gray-800 text-xs">{card.name}</div>
            )}

            {/* ✨ MAGIE EXPLOSIVE : Émojis ÉNORMES qui scintillent ✨ */}
            {card.isNew && !isStatic && (
              // On ajoute une lueur dorée de fond pour l'impact
              <div className="absolute inset-0 z-30 pointer-events-none drop-shadow-[0_0_20px_rgba(255,223,0,1)]">
                {/* Placement centré dans les coins pour l'effet d'échelle. animate-pulse + text-5xl = WOW */}
                <span className="absolute -top-1 left-2 text-5xl animate-pulse" style={{ animationDuration: '1.5s' }}>✨</span>
                <span className="absolute top-10 right-0 text-3xl animate-pulse" style={{ animationDuration: '2s', animationDelay: '0.5s' }}>✨</span>
                <span className="absolute bottom-6 left-1 text-4xl animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '0.2s' }}>✨</span>
                <span className="absolute bottom-0 -right-1 text-5xl animate-pulse" style={{ animationDuration: '1.2s', animationDelay: '0.8s' }}>✨</span>
              </div>
            )}

            {/* EFFETS HOLO DE BASE */}
            <div ref={glareRef} className="hidden md:block absolute inset-0 z-40 pointer-events-none mix-blend-overlay opacity-0" />
            {holoConfig.hasFoil && (
              <div 
                ref={foilRef} 
                className="hidden md:block absolute inset-0 z-50 pointer-events-none opacity-0" 
                style={{ background: holoConfig.foilBackground, backgroundSize: holoConfig.size, mixBlendMode: holoConfig.blendMode }} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}