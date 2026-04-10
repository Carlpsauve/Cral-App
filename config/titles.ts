export const TITLES_CONFIG: Record<string, { label: string, ringClass: string, textClass: string, tagClass: string, sidebarRing: string }> = {
  
  'super_admin': {
    label: '⚡ Super Admin',
    ringClass: 'p-1 rounded-[1.2rem] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.6)]',
    textClass: 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 font-black',
    tagClass: 'text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest text-white bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.6)] animate-pulse',
    sidebarRing: 'p-[2px] rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.6)]'
  },

  // ✨ --- LES TITRES DONATEURS --- ✨

  'donateur_1': {
    label: '💵 Le Grand Généreux',
    // ✨ Nouveau contour OR : dégradé or sombre vers or clair avec une ombre dorée
    ringClass: 'p-1 rounded-[1.2rem] bg-gradient-to-tr from-yellow-600 via-yellow-300 to-yellow-600 shadow-[0_0_15px_rgba(234,179,8,0.5)]',
    textClass: 'text-yellow-400 font-bold',
    // Tag harmonisé avec l'or
    tagClass: 'text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest text-yellow-200 bg-yellow-950/60 border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.3)]',
    sidebarRing: 'p-[2px] rounded-full bg-gradient-to-tr from-yellow-600 via-yellow-300 to-yellow-600 shadow-[0_0_10px_rgba(234,179,8,0.4)]'
  },

  'donateur_5': {
    label: '💸 Le Jean-Francis Généreux', // Billet avec des ailes
    ringClass: 'p-1 rounded-[1.2rem] bg-gradient-to-tr from-slate-300 via-cyan-400 to-blue-500 shadow-[0_0_20px_rgba(6,182,212,0.6)]',
    textClass: 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 font-black',
    tagClass: 'text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest text-cyan-300 bg-cyan-950/80 border border-cyan-400/60 shadow-[0_0_15px_rgba(6,182,212,0.5)] animate-pulse',
    sidebarRing: 'p-[2px] rounded-full bg-gradient-to-tr from-slate-300 via-cyan-400 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
  },

  'donateur_vip': {
    label: '💎 Le Jean-Marc Généreux', // Diamant
    ringClass: 'p-1 rounded-[1.2rem] bg-gradient-to-tr from-yellow-300 via-pink-500 to-purple-600 shadow-[0_0_25px_rgba(236,72,153,0.8)]',
    textClass: 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 font-black',
    tagClass: 'text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest text-yellow-300 bg-pink-950/90 border border-pink-500 shadow-[0_0_25px_rgba(236,72,153,0.8)] animate-pulse',
    sidebarRing: 'p-[2px] rounded-full bg-gradient-to-tr from-yellow-300 via-pink-500 to-purple-600 shadow-[0_0_15px_rgba(236,72,153,0.7)]'
  },

  // ✨ ----------------------------- ✨
  
  'cral_slayer': {
    label: '🗡️ Cral Slayer',
    ringClass: 'p-1 rounded-[1.2rem] bg-gradient-to-tr from-red-600 via-orange-500 to-yellow-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]',
    textClass: 'text-red-400',
    tagClass: 'text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest text-orange-400 border border-red-500/50 bg-red-950 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse',
    sidebarRing: 'p-[2px] rounded-full bg-gradient-to-tr from-red-600 via-orange-500 to-yellow-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
  },
  
  'homme_blanc_chauve': {
    label: '🦲 Homme Blanc Chauve',
    ringClass: 'p-1 rounded-[1.2rem] bg-gray-500 shadow-[0_0_15px_rgba(107,114,128,0.5)]',
    textClass: 'text-gray-300',
    tagClass: 'text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-gray-500/20 text-gray-300 border border-gray-500/50',
    sidebarRing: 'p-[2px] rounded-full bg-gray-500 shadow-[0_0_10px_rgba(107,114,128,0.5)]'
  },
  
  'boomer_base_set': {
    label: '🦕 Boomer du Set de Base',
    ringClass: 'p-1 rounded-[1.2rem] bg-gradient-to-br from-yellow-400 to-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]',
    textClass: 'text-yellow-400 font-black',
    tagClass: 'text-[10px] px-2 py-0.5 rounded bg-blue-900/40 text-yellow-400 border border-yellow-500/50 font-bold uppercase tracking-wider',
    sidebarRing: 'p-[2px] rounded-full bg-gradient-to-br from-yellow-400 to-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
  },
  
  'buveur_encre': {
    label: '🖋️ Buveur d\'Encre (Lorcana)',
    ringClass: 'p-1 rounded-[1.2rem] bg-gradient-to-r from-purple-600 to-indigo-600 shadow-[0_0_15px_rgba(147,51,234,0.5)]',
    textClass: 'text-purple-400 font-serif italic',
    tagClass: 'text-[10px] px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-500/50 font-serif',
    sidebarRing: 'p-[2px] rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 shadow-[0_0_10px_rgba(147,51,234,0.5)]'
  }
}

export const DEFAULT_TITLE_CONFIG = {
  ringClass: 'p-1 rounded-[1.2rem] border-2 border-transparent',
  textClass: 'text-cral-text',
  tagClass: 'text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-cral-surface text-cral-sub border border-white/5',
  sidebarRing: ''
}