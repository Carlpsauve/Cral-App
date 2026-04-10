import { getCardsBySet } from "./tcgdex"; // Vérifie bien que le chemin est "./tcgdex"
import { getLorcanaSetCards } from "./lorcana";

export async function getAllSetCards(setId: string) {
  if (setId.startsWith('lorcana-') || ['TFC', 'ROF', 'ITI'].includes(setId)) {
    const cleanId = setId.replace('lorcana-', '');
    const mapping: Record<string, string> = { '1': 'TFC', '2': 'ROF', '3': 'ITI' };
    return await getLorcanaSetCards(mapping[cleanId] || setId);
  }
  return await getCardsBySet(setId);
}