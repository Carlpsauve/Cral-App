// config/cards.ts

export const SPECIAL_CARD_PRICES: Record<string, number> = {
  // --- LES LÉGENDAIRES & STARS (500₡ - 250₡) ---
  "dracaufeu": 500,
  "mewtwo": 250,
  "lugia": 250,
  "rayquaza": 250,
  "mew": 150,

  // --- BOOSTER FOSSILE (Les Oiseaux Légendaires & Dracos) ---
  "sulfura": 110,      // Moltres - Star de Fossile
  "electhor": 110,     // Zapdos - Star de Fossile
  "artikodin": 110,    // Articuno - Star de Fossile
  "dracolosse": 100,   // Dragonite - La carte la plus iconique de Fossile
  "kicklee": 40,       // Hitmonlee
  "ectoplasma": 80,   // Gengar - Très recherché par les fans

  // --- BOOSTER JUNGLE (Évolutions finales & Évoli) ---
  "pyroli": 80,       // Flareon
  "aquali": 80,       // Vaporeon
  "voltali": 80,      // Jolteon
  "insécateur": 75,   // Scyther - La "Chase Card" de Jungle avec Kangourex
  "kangourex": 50,    // Kangaskhan
  "scarabrute": 30,    // Pinsir
  "lokhlass": 50,      // Lapras

  // --- LES STARTERS & CLASSIQUES (100₡) ---
  "tortank": 50,
  "bulbizarre": 50,
  "florizarre": 50,
  "pikachu": 100,

  // --- SPÉCIAL 151 (Ratios adaptés pour un pack à 40₡) ---
  "mew ex": 400,       // La star du set
  "alakazam ex": 150,  
  "kadabra": 30,       // Clin d'œil car il était absent longtemps
  "evoli": 25,         // Toujours populaire
};

export const RARITY_RATIOS: Record<string, number> = {
  "secrète": 0.75,      // 75% du prix (Vente à 15₡ si pack à 20₡)
  "ultra": 0.50,        // 50% du prix (Vente à 10₡ si pack à 20₡)
  "holo": 0.40,         // 40% du prix (Vente à 8₡ si pack à 20₡)
  "rare": 0.20,         // 20% du prix (Vente à 4₡ si pack à 20₡)
  "peu commune": 0.10,  // 10% du prix (Vente à 2₡ si pack à 20₡)
  "commune": 0.05,      // 5% du prix  (Vente à 1₡ si pack à 20₡)
};