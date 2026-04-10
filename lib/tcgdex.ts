// Définition des types pour l'API TCGdex
export interface TCGCardDef {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

export interface TCGCardDetails extends TCGCardDef {
  illustrator?: string;
  rarity: string;
  category: string;
  set: {
    id: string;
    name: string;
    logo?: string;
  };
}

// Fonction pour récupérer une carte spécifique avec mise en cache
export async function getCardDetails(id: string): Promise<TCGCardDetails | null> {
  try {
    // next: { revalidate: 86400 } met en cache la réponse pendant 24h
    const res = await fetch(`https://api.tcgdex.net/v2/fr/cards/${id}`, {
      next: { revalidate: 86400 }
    });
    
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Erreur TCGdex:", error);
    return null;
  }
}

export interface TCGSetDetails {
  id: string;
  name: string;
  cards: TCGCardDef[];
}

// Fonction pour récupérer toutes les cartes d'un set
export async function getSetDetails(setId: string): Promise<TCGSetDetails | null> {
  try {
    const res = await fetch(`https://api.tcgdex.net/v2/fr/sets/${setId}`, {
      next: { revalidate: 86400 } // En cache pour 24h
    });
    
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Erreur récupération Set TCGdex:", error);
    return null;
  }
}

export async function getCardsBySet(setId: string): Promise<TCGCardDef[]> {
  const details = await getSetDetails(setId);
  return details?.cards || [];
}