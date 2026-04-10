// lib/lorcana.ts

export interface LorcanaCard {
  id: string;
  localId: string;
  name: string;
  image: string;
  rarity: string;
  set: {
    id: string;
    name: string;
  };
}

export async function getLorcanaSetCards(setId: string): Promise<LorcanaCard[]> {
  try {
    // ✨ PASSAGE À LORCAST API ✨
    // Lorcast est la référence officielle et inclut GARANTI toutes les cartes Enchanted
    let setNum = "1";
    if (setId === "ROF" || setId === "lorcana-2") setNum = "2";
    if (setId === "ITI" || setId === "lorcana-3") setNum = "3";
    if (setId === "TFC" || setId === "lorcana-1") setNum = "1";

    const res = await fetch(`https://api.lorcast.com/v0/sets/${setNum}/cards`, {
      cache: "no-store" // On force la mise à jour pour oublier l'ancienne API
    });
    
    if (!res.ok) {
      throw new Error("Impossible de joindre l'API Lorcast");
    }

    const data = await res.json();

    // On transforme les données Lorcast pour qu'elles rentrent parfaitement dans ton application
    return data.map((card: any) => {
      // Lorcast renvoie les raretés en minuscules (ex: "enchanted"), on met une majuscule pour l'esthétique
      const rawRarity = card.rarity || "common";
      const formattedRarity = rawRarity.charAt(0).toUpperCase() + rawRarity.slice(1);

      return {
        // 🚨 IMPORTANT : On conserve EXACTEMENT ton format d'ID pour ne pas casser tes cartes déjà possédées
        id: `lorcana-${setNum}-${card.collector_number}`, 
        localId: String(card.collector_number), // Indispensable pour le tri de l'Album
        
        // Lorcast sépare le nom ("Elsa") et la version ("Spirit of Winter"), on les assemble !
        name: card.version ? `${card.name} - ${card.version}` : card.name,
        
        // On utilise la source "normal" qui offre une super qualité sans faire exploser la RAM
        image: card.image_uris?.digital?.normal || card.image_uris?.digital?.small || "",
        
        rarity: formattedRarity,
        set: {
          id: setId,
          name: card.set?.name || "Lorcana Set"
        }
      };
    });

  } catch (error) {
    console.error("Erreur lib/lorcana.ts:", error);
    return [];
  }
}