export interface GeoQuestion {
  id: number
  category: 'city' | 'country' | 'landmark' | 'culture'
  clues: string[]
  options: string[]
  answer: string
  difficulty: 1 | 2 | 3 // 1=easy, 2=medium, 3=hard
  baseReward: number // Cral$ won for correct answer
}

export const GEO_QUESTIONS: GeoQuestion[] = [
  // Cities
  { id: 1, category: 'city', difficulty: 1, baseReward: 2,
    clues: ['Surnommée la Ville Lumière', 'La tour Eiffel s\'y trouve', 'Capitale sur la Seine'],
    options: ['Paris', 'Lyon', 'Marseille', 'Bordeaux'], answer: 'Paris' },
  { id: 2, category: 'city', difficulty: 1, baseReward: 2,
    clues: ['Times Square', 'La Statue de la Liberté est proche', 'Ville qui ne dort jamais'],
    options: ['Los Angeles', 'Chicago', 'New York', 'Miami'], answer: 'New York' },
  { id: 3, category: 'city', difficulty: 2, baseReward: 4,
    clues: ['Carnaval mondial célèbre', 'Christ Rédempteur surplombe la ville', 'Baie de Guanabara'],
    options: ['São Paulo', 'Buenos Aires', 'Lima', 'Rio de Janeiro'], answer: 'Rio de Janeiro' },
  { id: 4, category: 'city', difficulty: 2, baseReward: 4,
    clues: ['Canaux et gondoles', 'Construit sur des îles', 'Carnaval masqué'],
    options: ['Amsterdam', 'Venise', 'Bruges', 'Rotterdam'], answer: 'Venise' },
  { id: 5, category: 'city', difficulty: 2, baseReward: 4,
    clues: ['Mecca du cricket', 'L\'Opéra en coquilles de béton', 'Harbour Bridge'],
    options: ['Melbourne', 'Sydney', 'Auckland', 'Brisbane'], answer: 'Sydney' },
  { id: 6, category: 'city', difficulty: 3, baseReward: 8,
    clues: ['Anatolie', 'Anciennement Constantinople', 'Pont entre deux continents'],
    options: ['Athènes', 'Beyrouth', 'Istanbul', 'Izmir'], answer: 'Istanbul' },
  { id: 7, category: 'city', difficulty: 3, baseReward: 8,
    clues: ['La Sagrada Família', 'Las Ramblas', 'Côte méditerranéenne catalane'],
    options: ['Madrid', 'Barcelone', 'Valence', 'Séville'], answer: 'Barcelone' },
  { id: 8, category: 'city', difficulty: 3, baseReward: 8,
    clues: ['Ancienne capitale ottomane', 'Bursa est voisine', 'Mosquée Verte célèbre'],
    options: ['Ankara', 'Bursa', 'Konya', 'Istanbul'], answer: 'Bursa' },
  // Countries
  { id: 9, category: 'country', difficulty: 1, baseReward: 2,
    clues: ['Pays des kangourous', 'Continent-pays', 'Canberra est la capitale'],
    options: ['Nouvelle-Zélande', 'Australie', 'Papouasie', 'Fidji'], answer: 'Australie' },
  { id: 10, category: 'country', difficulty: 1, baseReward: 2,
    clues: ['Maple syrup', 'Deuxième plus grand pays du monde', 'Capitale Ottawa'],
    options: ['États-Unis', 'Canada', 'Russie', 'Groenland'], answer: 'Canada' },
  { id: 11, category: 'country', difficulty: 2, baseReward: 4,
    clues: ['Plus de volcans actifs qu\'ailleurs', 'Archipel du Pacifique', 'Mont Fuji'],
    options: ['Philippines', 'Indonésie', 'Japon', 'Taïwan'], answer: 'Japon' },
  { id: 12, category: 'country', difficulty: 2, baseReward: 4,
    clues: ['Tango argentin... mais non', 'Andes et Atacama', 'Vins Carmenère'],
    options: ['Argentine', 'Pérou', 'Chili', 'Bolivie'], answer: 'Chili' },
  { id: 13, category: 'country', difficulty: 3, baseReward: 8,
    clues: ['Seul pays entouré par l\'Italie', 'République depuis 301 apr. J-C', 'Mont Titan'],
    options: ['Vatican', 'Monaco', 'Saint-Marin', 'Liechtenstein'], answer: 'Saint-Marin' },
  { id: 14, category: 'country', difficulty: 3, baseReward: 8,
    clues: ['Sans accès à la mer', 'Entouré de pays sans mer', 'Landlocked landlocked'],
    options: ['Bolivie', 'Kazakhstan', 'Ouzbékistan', 'Liechtenstein'], answer: 'Ouzbékistan' },
  // Landmarks
  { id: 15, category: 'landmark', difficulty: 1, baseReward: 2,
    clues: ['Construit entre 1887 et 1889', 'Exposé en fer forgé', 'Initialement controversé'],
    options: ['Big Ben', 'Tour Eiffel', 'Arc de Triomphe', 'Sacré-Cœur'], answer: 'Tour Eiffel' },
  { id: 16, category: 'landmark', difficulty: 2, baseReward: 4,
    clues: ['Mausolée en marbre blanc', '1632 à 1653 de construction', 'Agra, Inde'],
    options: ['Palais d\'été', 'Taj Mahal', 'Angkor Vat', 'Borobudur'], answer: 'Taj Mahal' },
  { id: 17, category: 'landmark', difficulty: 2, baseReward: 4,
    clues: ['Construit par les Incas', 'Altitude 2430m', 'Cité perdue redécouverte en 1911'],
    options: ['Chichen Itza', 'Machu Picchu', 'Tiwanaku', 'Chan Chan'], answer: 'Machu Picchu' },
  { id: 18, category: 'landmark', difficulty: 3, baseReward: 8,
    clues: ['Taillé dans la roche rose', 'Nabatéens', 'Jordanie — ville rose-rouge'],
    options: ['Persépolis', 'Palmyre', 'Pétra', 'Jerash'], answer: 'Pétra' },
  // Culture
  { id: 19, category: 'culture', difficulty: 1, baseReward: 2,
    clues: ['Plat national du Japon', 'Nouilles dans un bouillon', 'Souvent garni d\'œuf mollet'],
    options: ['Pho', 'Ramen', 'Pad thaï', 'Udon'], answer: 'Ramen' },
  { id: 20, category: 'culture', difficulty: 2, baseReward: 4,
    clues: ['Sport national du Canada', 'Rondelle sur glace', 'Stanley Cup'],
    options: ['Curling', 'Ringuette', 'Hockey sur glace', 'Patinage de vitesse'], answer: 'Hockey sur glace' },
  { id: 21, category: 'culture', difficulty: 2, baseReward: 4,
    clues: ['Festival de lumières indien', 'Diwali alias...', 'Lampes à huile traditionnelles'],
    options: ['Holi', 'Diwali', 'Navratri', 'Pongal'], answer: 'Diwali' },
  { id: 22, category: 'culture', difficulty: 3, baseReward: 8,
    clues: ['Danse traditionnelle maorie', 'Nouvelle-Zélande', 'All Blacks la pratiquent'],
    options: ['Siva', 'Haka', 'Kapa haka', 'Poi'], answer: 'Haka' },
  { id: 23, category: 'city', difficulty: 2, baseReward: 4,
    clues: ['Surnommée Montréal du Nord', 'Porte de l\'Arctique', 'Capitale du Nunavut'],
    options: ['Yellowknife', 'Iqaluit', 'Whitehorse', 'Churchill'], answer: 'Iqaluit' },
  { id: 24, category: 'city', difficulty: 3, baseReward: 8,
    clues: ['Ville flottante sur le lac Titicaca', 'Îles Uros', 'Pérou-Bolivie'],
    options: ['Puno', 'Cusco', 'La Paz', 'Copacabana'], answer: 'Puno' },
  { id: 25, category: 'country', difficulty: 2, baseReward: 4,
    clues: ['Pays des 1000 lacs', 'Sauna inventé ici', 'Helsinki est la capitale'],
    options: ['Suède', 'Norvège', 'Finlande', 'Estonie'], answer: 'Finlande' },
  { id: 26, category: 'landmark', difficulty: 3, baseReward: 8,
    clues: ['Colisée rival romain', 'En Turquie', 'Éphèse côté'],
    options: ['Théâtre d\'Éphèse', 'Colisée d\'Aspendos', 'Théâtre de Pergame', 'Odéon d\'Athènes'], answer: 'Colisée d\'Aspendos' },
  { id: 27, category: 'culture', difficulty: 1, baseReward: 2,
    clues: ['Boisson nationale du Québec', 'Gin local célèbre', 'Sirop d\'érable dedans'],
    options: ['Caesar', 'Caribou', 'Gin tonic', 'Microbrasserie IPA'], answer: 'Caribou' },
  { id: 28, category: 'city', difficulty: 1, baseReward: 2,
    clues: ['Métropole québécoise', 'Vieux-Port', 'Festival de jazz mondial'],
    options: ['Québec', 'Montréal', 'Laval', 'Longueuil'], answer: 'Montréal' },
]

export function getRandomQuestion(excludeIds: number[] = []): GeoQuestion {
  const available = GEO_QUESTIONS.filter(q => !excludeIds.includes(q.id))
  const pool = available.length > 0 ? available : GEO_QUESTIONS
  return pool[Math.floor(Math.random() * pool.length)]
}

export function shuffleOptions(q: GeoQuestion): string[] {
  const opts = [...q.options]
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]]
  }
  return opts
}

export const CATEGORY_LABELS: Record<string, string> = {
  city: '🏙️ Ville',
  country: '🌍 Pays',
  landmark: '🗺️ Monument',
  culture: '🎭 Culture',
}

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Facile',
  2: 'Moyen',
  3: 'Difficile',
}
