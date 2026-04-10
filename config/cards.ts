// config/cards.ts

export const SPECIAL_CARD_PRICES: Record<string, number> = {
  // --- LES LÉGENDAIRES & STARS (500₡ - 250₡) ---
  "dracaufeu": 500,
  "mewtwo": 250,
  "lugia": 250,
  "rayquaza": 250,
  "mew": 150,

  // --- BOOSTER FOSSILE (Les Oiseaux Légendaires & Dracos) ---
  "sulfura": 110,      
  "electhor": 110,     
  "artikodin": 110,    
  "dracolosse": 100,   
  "kicklee": 40,       
  "ectoplasma": 80,   

  // --- BOOSTER JUNGLE (Évolutions finales & Évoli) ---
  "pyroli": 80,       
  "aquali": 80,       
  "voltali": 80,      
  "insécateur": 75,   
  "kangourex": 50,    
  "scarabrute": 30,    
  "lokhlass": 50,      

  // --- LES STARTERS & CLASSIQUES (100₡) ---
  "tortank": 50,
  "bulbizarre": 50,
  "florizarre": 50,
  "pikachu": 100,

  // --- SPÉCIAL 151 (Ratios adaptés pour un pack à 40₡) ---
  "mew-ex": 1000,       
  "alakazam-ex": 150,  
  "kadabra": 30,       
  "evoli": 25,         
};

export const RARITY_RATIOS: Record<"pokemon" | "lorcana", Record<string, number>> = {
  // --- LORCANA ---
  lorcana: {
    "enchanted": 100.00,  
    "legendary": 10.00,   
    "super rare": 0.5,    
    "rare": 0.20,         // ✨ Le nouveau ratio JUSTE pour Lorcana Bronze !
    "uncommon": 0.1,     
    "common": 0.05,       
  },
  
  // --- POKÉMON ---
  pokemon: {
    "secrète": 10,      
    "ultra": 5,        
    "holo": 2,         
    "rare": 1,          // 🔴 Le ratio qui reste fort pour Pokémon !
    "peu commune": 0.10,  
    "commune": 0.05,
    "uncommon": 0.10,     // Au cas où une carte Pokémon anglaise passe
    "common": 0.05,       // Au cas où une carte Pokémon anglaise passe
  }
};