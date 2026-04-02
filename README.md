# 🎰 CRAL — La monnaie des soirées

Application de monnaie fictive pour les soirées de jeux de société.

---

## 🚀 Déploiement en 4 étapes

### Étape 1 — Supabase

1. Créez un compte sur [supabase.com](https://supabase.com) et un nouveau projet
2. Dans **SQL Editor**, collez et exécutez tout le contenu de `supabase/schema.sql`
3. Dans **Project Settings → API**, copiez :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Dans **Authentication → URL Configuration**, ajoutez votre futur domaine Vercel dans **Redirect URLs** :
   ```
   https://votre-app.vercel.app/**
   ```

### Étape 2 — GitHub

```bash
git init
git add .
git commit -m "Initial commit — CRAL"
git remote add origin https://github.com/votre-username/cral-app.git
git push -u origin main
```

### Étape 3 — Vercel

1. Allez sur [vercel.com](https://vercel.com) → **Add New Project**
2. Importez votre repo GitHub
3. Dans **Environment Variables**, ajoutez :

| Nom | Valeur |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJxxx...` |

4. Cliquez **Deploy** 🎉

### Étape 4 — Premier Super Admin

Après votre première inscription sur l'app :
1. Supabase → **Table Editor → profiles**
2. Trouvez votre ligne
3. Changez `role` de `plebe` → `super_admin`

---

## 🏗️ Structure du projet

```
cral-app/
├── app/
│   ├── (app)/                      # Pages protégées (avec sidebar)
│   │   ├── layout.tsx              # Layout : sidebar desktop + nav mobile
│   │   ├── loading.tsx             # Skeleton de chargement
│   │   ├── dashboard/page.tsx      # Tableau de bord
│   │   ├── gajures/
│   │   │   ├── page.tsx            # Liste des gajures + badges invitation
│   │   │   ├── new/page.tsx        # Créer une gajure
│   │   │   └── [id]/page.tsx       # Détail + votes temps réel
│   │   ├── daily/page.tsx          # Machine à sous quotidienne
│   │   ├── classement/page.tsx     # Podium + classement complet
│   │   ├── historique/page.tsx     # Toutes les transactions
│   │   ├── profil/
│   │   │   ├── page.tsx            # Serveur : stats
│   │   │   └── ProfileClient.tsx   # Client : éditeur profil
│   │   └── admin/
│   │       ├── page.tsx            # Guard super_admin
│   │       └── AdminPanel.tsx      # Panel admin temps réel
│   ├── api/
│   │   ├── bets/
│   │   │   ├── resolve/route.ts    # POST — résoudre une gajure (sécurisé)
│   │   │   └── cancel/route.ts     # POST — annuler une gajure
│   │   └── daily/
│   │       └── play/route.ts       # POST — jouer à la machine à sous
│   ├── auth/
│   │   ├── layout.tsx              # Fond commun pages auth
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── global-error.tsx            # Error boundary global
│   ├── not-found.tsx               # Page 404
│   ├── layout.tsx                  # Root layout + fonts
│   ├── page.tsx                    # Landing (redirige si connecté)
│   └── globals.css
├── components/layout/
│   ├── Sidebar.tsx                 # Nav desktop + badges + balance temps réel
│   └── MobileNav.tsx               # Nav mobile (bottom bar)
├── lib/
│   ├── supabase-server.ts          # Client Supabase (Server Components)
│   ├── supabase-client.ts          # Client Supabase (Client Components)
│   ├── supabase-middleware.ts      # Session middleware
│   ├── slots.ts                    # Logique machine à sous (RNG, évaluation)
│   └── utils.ts                    # Helpers (cn, formatCral, formatDate…)
├── types/index.ts                  # Types TypeScript
├── supabase/schema.sql             # Schéma complet (tables + RLS + fonctions)
└── middleware.ts                   # Middleware Next.js (protection routes)
```

---

## ⚙️ Fonctionnalités complètes

### 🔐 Authentification
- Inscription avec email + mot de passe + choix du pseudo
- Connexion, déconnexion
- Mot de passe oublié (email de réinitialisation)
- Sessions gérées par Supabase SSR (cookies)
- Redirection automatique : connecté → dashboard, non connecté → login

### 💰 Cral dollars
- Chaque nouveau compte reçoit **₡100** automatiquement (trigger PostgreSQL)
- Solde bloqué à **₡0** minimum (impossible d'aller en négatif)
- Toutes les transactions sont enregistrées et visibles par tous

### 🎲 Gajures (paris)
| Étape | Description |
|-------|-------------|
| Création | Titre, description, mise par joueur, sélection des participants |
| Invitation | Les invités voient un badge sur la nav et une bannière sur la gajure |
| Vote | Le créateur démarre le vote → les participants votent pour le gagnant |
| Résolution | Majorité simple → transfert automatique via fonction PostgreSQL |
| Admin | Le Super Admin peut désigner le gagnant ou annuler à tout moment |

- **Temps réel** : votes et statuts mis à jour instantanément via Supabase Realtime WebSockets
- **Sécurisé** : la résolution passe par une API route (validation serveur) + fonction `SECURITY DEFINER`

### 🎰 Daily Game (Machine à sous)
- **1 partie par jour** — reset à **minuit heure de Montréal** (EST/EDT géré)
- 5 lignes disponibles, jouez 1 à 5 lignes simultanément
- Mise par ligne : ₡0.50 à ₡10 (selon votre solde)
- Animation ligne par ligne avec effet de spin
- **RNG côté serveur** (API route) — impossible de tricher
- Retour espéré ≈ 75% (difficile par design)
- Jackpot 💎💎💎 = ×50 (probabilité ≈ 0.08%)
- Countdown en temps réel jusqu'au prochain reset

### 🏆 Classement
- Podium visuel top 3
- Classement complet avec gains gajures + daily séparés
- Variation de solde depuis le départ (₡100)

### 📋 Historique
- Toutes les transactions de tous les joueurs, visibles par tous
- Groupées par jour (heure de Montréal)

### 👤 Profil
- Modifier son pseudo
- Choisir parmi 12 couleurs d'avatar
- Stats : total gagné/perdu, win rate gajures, parties daily jouées, bilan net

### 🛡️ Admin (Super Admin)
- **Créditer / débiter** n'importe quel joueur avec transaction enregistrée
- **Reset à ₡100** en un clic
- **Changer les rôles** (plebe ↔ super_admin)
- Statistiques globales : circulation totale, solde moyen, inflation/déflation
- Balances mises à jour en **temps réel** sans refresh

---

## 🔒 Sécurité

- **RLS (Row Level Security)** activé sur toutes les tables
- La résolution des gajures utilise `SECURITY DEFINER` — aucun client ne peut manipuler les soldes directement
- Les API routes valident l'authentification et les permissions côté serveur
- Le RNG de la machine à sous s'exécute côté serveur uniquement
- Le middleware Next.js protège toutes les routes `/dashboard`, `/gajures`, `/daily`, etc.

---

## 🛠️ Développement local

```bash
# Installer les dépendances
npm install

# Créer le fichier d'environnement
cp .env.local.example .env.local
# Remplir avec vos clés Supabase

# Démarrer le serveur de dev
npm run dev
# → http://localhost:3000
```

---

## 🐛 Dépannage

**Les styles ne s'affichent pas**
→ Vérifiez que `npm install` a bien été exécuté

**Erreur "Invalid API key"**
→ Vérifiez vos variables d'environnement dans Vercel (Settings → Environment Variables)

**"relation does not exist"**
→ Vous n'avez pas exécuté `supabase/schema.sql`. Relancez-le dans l'éditeur SQL Supabase.

**Les emails de reset n'arrivent pas**
→ Vérifiez le dossier spam. Dans Supabase → Authentication → Email Templates, vérifiez que l'email est configuré.

**L'app redirige en boucle**
→ Dans Supabase → Authentication → URL Configuration, assurez-vous que votre domaine est dans la liste des Redirect URLs.

**La machine à sous dit "déjà joué" alors que non**
→ Vérifiez que le timezone est bien `America/Montreal`. Le reset se fait à minuit heure locale de Montréal.

---

## 📊 Schéma de base de données

| Table | Rôle |
|-------|------|
| `profiles` | Joueurs — balance, role, avatar_color |
| `bets` | Gajures — titre, montant, statut, gagnant |
| `bet_participants` | Qui participe à chaque gajure + acceptation |
| `bet_votes` | Votes des participants pour désigner le gagnant |
| `transactions` | Historique complet de tous les mouvements |
| `daily_plays` | Une ligne par joueur par jour (machine à sous) |

---

## 🎨 Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 14 (App Router, Server + Client Components) |
| Base de données | Supabase (PostgreSQL + Auth + Realtime) |
| Styles | Tailwind CSS (design system custom dark) |
| Typage | TypeScript |
| Fonts | Playfair Display (titres) · DM Sans (corps) · DM Mono (chiffres) |
| Icônes | Lucide React |
| Déploiement | Vercel |
