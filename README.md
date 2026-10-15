# SMART CITY RDC 2035

Plateforme nationale intelligente de gestion urbaine du Gouvernement de la République Démocratique du Congo.

## Vue d'ensemble

SMART CITY RDC 2035 est une plateforme gouvernementale complète qui connecte le Gouvernement, les Ministères, les Provinces, les Communes, les Services Publics et les Citoyens à travers une interface unifiée de gestion urbaine intelligente.

## Architecture RBAC multi-rôles

La plateforme implémente un contrôle d'accès basé sur les rôles (RBAC) à 3 niveaux :

1. **Row Level Security (PostgreSQL)** — Chaque table est protégée au niveau base de données
2. **Edge Functions RBAC** — Toutes les API valident le JWT et le rôle
3. **Frontend Role Guard** — Le composant `RoleGuard` protège chaque tableau de bord

### Rôles et permissions

| Rôle | Tableau de bord | Accès |
|------|----------------|------|
| `admin` | `/dashboard/admin` | Accès complet, gestion utilisateurs, paramètres |
| `government` | `/dashboard/government` | Supervision nationale |
| `ministry` | `/dashboard/ministry` | Gestion ministérielle |
| `province` | `/dashboard/province` | Données provinciales |
| `commune` | `/dashboard/commune` | Données communales |
| `police` | `/dashboard/police` | Incidents, sécurité, interventions |
| `emergency` | `/dashboard/emergency` | Urgences et interventions |
| `water` | `/dashboard/water` | Réservoirs, consommation, fuites |
| `energy` | `/dashboard/energy` | Centrales, lampadaires, coupures |
| `waste` | `/dashboard/waste` | Bacs, camions, tournées |
| `transport` | `/dashboard/transport` | Trafic, routes, feux |
| `agent` | `/dashboard/agent` | Missions assignées |
| `citizen` | `/citizen` | Profil, signalements, notifications |

### Redirection après connexion

Après authentification, l'utilisateur est automatiquement redirigé vers son tableau de bord selon son rôle (voir `lib/dashboard-roles.ts` → `getRoleHome()`).

### Menu latéral

La sidebar est générée dynamiquement selon le rôle. Chaque rôle ne voit que les menus et tableaux de bord qui lui sont autorisés.

## Installation locale

### Prérequis
- Node.js 20+
- npm 10+

### Démarrage
```bash
# Installer les dépendances
npm install

# Copier les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos valeurs Supabase

# Lancer le serveur de développement
npm run dev
```

## Variables d'environnement

### Fichiers
- `.env.example` — Modèle de référence (commit dans Git)
- `.env.local` — Développement local (ignoré par Git)
- `.env.development` — Configuration développement (commit dans Git)
- `.env.production` — Configuration production (ignoré par Git)

### Variables requises

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme (client) | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service (server only) | `eyJ...` |
| `SUPABASE_DB_URL` | URL PostgreSQL | `postgresql://...` |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app | `http://localhost:3000` |
| `ADMIN_SEED_PASSWORD` | Mot de passe admin démo | (auto-généré si vide) |
| `ALLOWED_ORIGINS` | Origines CORS autorisées | `http://localhost:3000` |

## Déploiement

### Docker
```bash
# Copier et remplir .env.production
cp .env.example .env.production

# Build et démarrage
docker-compose up -d
```

### Vercel
1. Connectez le dépôt à Vercel
2. Configurez les variables d'environnement dans le dashboard Vercel
3. Déploiement automatique

### VPS Linux
```bash
# Build
npm run build

# Démarrer
npm start

# Ou avec Docker
docker-compose up -d
```

## Comptes de démonstration

> **AVERTISSEMENT** : aucun mot de passe de démonstration n'est publié ni embarqué dans le code.
> Les comptes `@smartcity-rdc.cd` sont créés à la demande par la fonction `provision-demo`
> (`ALLOW_DEMO_PROVISIONING=true` + `ADMIN_SEED_PASSWORD` ≥ 16 caractères fournis en secret) et
> uniquement sur un environnement de démonstration. Communiquez le mot de passe aux jurés **hors du dépôt**.
> Sur tout environnement où la migration 017 d'origine a déjà tourné, exécutez
> `supabase/maintenance/rotate_demo_passwords.sql` : ces comptes ont eu le mot de passe public `demo1234`.

## Sécurité

### Protection contre le brute-force
- Protection réelle : limites de débit de Supabase Auth. Le compteur `login_attempts` est consultatif (alimenté côté client via `record_login_attempt`), il ne remplace pas ce contrôle
- Journalisation dans `login_attempts` et `security_events` (identité dérivée de `auth.uid()`)

### Edge Functions
- JWT validé via `supabase.auth.getUser()` avec l'ANON KEY
- SERVICE ROLE KEY utilisée uniquement pour les requêtes REST internes
- CORS fermé par défaut : seules les origines listées dans `ALLOWED_ORIGINS` sont acceptées
- Codes de retour : 401 (non authentifié), 403 (non autorisé)

### RLS
- Chaque table a RLS activé
- Les citoyens ne voient que leurs propres données
- Les administrateurs ont un accès complet pour l'audit

## Tests

```bash
npm run lint        # Linting
npx tsc --noEmit    # Vérification des types
npm run build       # Build de production
```

## Dépannage

### Erreur EAGAIN pendant le build
Relancez `npm run build` — c'est une erreur temporaire du système de fichiers.

### Page blanche après connexion
Vérifiez que `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont correctement définis.

### Accès refusé aux Edge Functions
Vérifiez que `ALLOWED_ORIGINS` contient l'URL de votre application.

## Licence

© Gouvernement de la République Démocratique du Congo. Tous droits réservés.


## Documentation ajoutée (audit du 14/10/2026)
- `docs/GEMINI_SETUP.md` — configuration Google Gemini (secrets, modèle, test réel)
- `docs/MIGRATIONS_GUIDE.md` — secrets, migrations, déploiement, historique Supabase
- `docs/AUDIT_SQL_SECURITE.md` — rapport d'audit SQL/sécurité et tests
- `docs/MIGRATIONS_INVENTAIRE.md` — inventaire généré du schéma
- `database/` — `INSTALLATION_BASE_VIDE.sql`, `REPARATION_BASE_EXISTANTE.sql`, `DIAGNOSTIC_LECTURE_SEULE.sql`
