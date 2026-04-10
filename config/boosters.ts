export type GameType = "pokemon" | "lorcana";

export const BOOSTER_CONFIG = {
  // --- POKÉMON ---
  "base1": {
    name: "Set de Base",
    price: 20,
    image: "/booster-base.png",
    game: "pokemon" as GameType,
  },
  "base2": {
    name: "Jungle",
    price: 10,
    image: "/booster-jungle.png",
    game: "pokemon" as GameType,
  },
  "base3": {
    name: "Fossile",
    price: 10,
    image: "/booster-fossil.png",
    game: "pokemon" as GameType,
  },
  "sv03.5": {
    name: "Écarlate et Violet — 151",
    price: 50, 
    image: "/booster-151.png",
    game: "pokemon" as GameType,
  },

  // --- LORCANA ---
  "TFC": {
    name: "Premier Chapitre",
    price: 15,
    image: "/booster-lorcana-tfc.png", // Pense à ajouter cette image !
    game: "lorcana" as GameType,
  },
  "ROF": {
    name: "L'Ascension des Flots",
    price: 15,
    image: "/booster-lorcana-rof.png", // Pense à ajouter cette image !
    game: "lorcana" as GameType,
  },
  "ITI": {
    name: "Les Terres d'Encres",
    price: 15,
    image: "/booster-lorcana-iti.png", // Pense à ajouter cette image !
    game: "lorcana" as GameType,
  }
} as const;

export type BoosterSetId = keyof typeof BOOSTER_CONFIG;