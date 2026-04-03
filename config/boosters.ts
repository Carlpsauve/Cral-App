export const BOOSTER_CONFIG = {
  "base1": {
    name: "Set de Base",
    price: 20,
    image: "/booster-base.png",
  },
  "base2": {
    name: "Jungle",
    price: 10,
    image: "/booster-jungle.png",
  },
  "base3": {
    name: "Fossile",
    price: 10,
    image: "/booster-fossil.png",
  },
  "mew": {
    name: "Écarlate et Violet — 151",
    price: 50, 
    image: "/booster-151.png",
  }
} as const;

export type BoosterSetId = keyof typeof BOOSTER_CONFIG;