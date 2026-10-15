# SMART CITY RDC 2035 — Rapport d'audit et de correction (2026-10-14)

> Mise à jour 2026-10-15 : photos de signalement (migration 024) et analyse multimodale Gemini ajoutées — voir `docs/RAPPORT_FINAL.md` (dont la passe de validation et la migration 025). La mention « Photo des signalements : retirée » plus bas est désormais obsolète.

> Honnêteté d'abord : ce rapport distingue ce qui a été **exécuté** de ce qui a seulement été **écrit**.
> L'environnement d'audit n'avait **ni accès au registre npm, ni PostgreSQL, ni Deno, ni projet Supabase**.
> Conséquence : `npm run build`, ESLint, `tsc --noEmit` complet, l'application des migrations et les tests RLS
> **n'ont PAS été exécutés**. Ils sont à lancer avant toute démonstration (section 5).

## 1. Résultat de l'audit initial (phase A)

### Fonctionnel et vérifié (par lecture du code)
- Structure Next.js 13 / Tailwind / Supabase Auth cohérente ; garde de rôles côté UI ; migrations 0135, 016, 019, 021 (RLS) globalement saines.
- Formulaire d'inscription : le rôle n'est pas attribuable librement (trigger `handle_new_user`).

### Partiellement fonctionnel
- Signalements : création OK mais statut/priorité décidés par le navigateur, événements d'historique insérés par le client (bloqués par la RLS → historique vide), tout utilisateur connecté pouvait lire tous les signalements.
- Carte : chargement des points SIG OK, mais `useMemo` sans dépendance `points` (marqueurs jamais mis à jour), CSS/icônes via unpkg, attribution incomplète.
- Dashboards admin / signalements / notifications : branchés sur la base.

### Simulé ou données de démonstration
- 13 tableaux de bord (national, présidentiel, gouvernement, ministère, province, commune, eau, énergie, déchets, transport, police, urgences, agent) : chiffres **codés en dur**, aucune requête.
- Carte : marqueurs de repli aux coordonnées `Math.random()`, « heatmap » à rayons aléatoires.
- Page citoyen : météo aléatoire, alertes et graphique fictifs.
- `ai-service` : **aucun appel à un modèle** ; séries `Math.random()` de repli, « confiance » codée en dur (0.87, …), optimisation déchets sur `fill_percent` simulé.
- `iot-ingest` : mesures générées aléatoirement qui modifiaient l'état des appareils réels ; aucune authentification d'appareil.
- Assistant citoyen : mots-clés (pas d'IA) avec promesses fausses (« SNEL notifiée », démarches disponibles).
- Page admin : « Opérationnel » codé en dur pour 5 services.
- Seeds SQL (appareils, télémétrie, incidents, points SIG, signalements) indiscernables de données réelles.
- Formulaire de signalement : délais d'intervention inventés (« 24 à 48 h »).

### Défectueux, dangereux ou non vérifié
- **CRITIQUE** : mot de passe `demo1234` affiché et pré-rempli dans le bundle client (`/login`) et posé sur le compte **admin** par la migration 017.
- **CRITIQUE** : migration 013 invalide (`DO $` au lieu de `DO $$`) et affichant le mot de passe admin dans les logs ; migration 010 vide ; extensions `.sql.sql`.
- **ÉLEVÉ** : le rôle `government` pouvait modifier les rôles (`is_admin()`), y compris le sien → élévation vers `admin`.
- **ÉLEVÉ** : `api-gateway` : `reporter_id` / `actor_id` pris dans le corps de requête, filtres PostgREST injectables (`status`, `category`…), transitions non contrôlées par rôle ; `ai-service` : injection via `model`.
- **ÉLEVÉ** : `audit_log`, `security_events`, `login_attempts` insérables anonymement (journaux falsifiables) ; verrouillage de connexion purement client.
- **MOYEN** : CORS `*` par défaut ; `export-reports` : injection de formules CSV, faux « Excel » ; page IA appelait les fonctions avec la clé **anon** (401 systématique) ; rôle persisté dans `localStorage` ; `Supabase` remplacé silencieusement par un faux projet ; fichiers `.env.production/.env.development` au nom de vrais fichiers d'environnement (contenu : valeurs fictives uniquement — aucune clé réelle trouvée).

## 2. Corrections appliquées

| Phase | Changement | Fichiers |
|---|---|---|
| B Sécurité | Mot de passe démo retiré du client ; raccourcis e-mail seulement si `NEXT_PUBLIC_DEMO_MODE=true` | `app/login/page.tsx` |
| B | CORS fermé par défaut, auth/rôles/validation/limites mutualisés | `supabase/functions/_shared/http.ts` |
| B | `provision-demo` désactivé sauf `ALLOW_DEMO_PROVISIONING=true` + `ADMIN_SEED_PASSWORD` ≥ 16 car. ; plus de mot de passe généré perdu | `provision-demo/index.ts` |
| B | Fichiers env renommés `*.example`, `.gitignore` renforcé, `.env.example` documenté | racine |
| B | Rôle non persisté côté client ; profils inactifs refusés ; bannière « backend non configuré » | `auth-store.ts`, `client.ts`, `dashboard/layout.tsx` |
| C Schéma | **Migration 022** (additive, idempotente) : drapeaux `is_demo`/`is_simulated` (seeds marqués, rien supprimé), `iot_device_credentials` (hash seul), anti-rejeu, triggers signalements (statut initial forcé, transitions contrôlées, événement `created` automatique), lecture propriétaire-ou-personnel, garde `role/is_active` réservée à un vrai admin (`is_super_admin`), RPC admin journalisées, logs non falsifiables, `get_reports_with_coords`, CHECK `ai_predictions` élargi | `migrations/20261013100000_022_…sql` |
| C | 013 : délimiteur corrigé, mot de passe non affiché ; 017 : opt-in explicite ; 010 documentée ; script manuel de rotation des mots de passe | migrations, `supabase/maintenance/` |
| D Carte/signalements | Carte réécrite : 3 sources identifiées (SIG, signalements, appareils), filtres, recherche, légende, actualisation, états chargement/erreur/hors-ligne/tuiles, attribution OSM complète, choix de position par clic → formulaire ; plus aucune coordonnée aléatoire | `dashboard/map/*` |
| D | Formulaire : coordonnées valides, erreurs GPS explicites, délais inventés supprimés, événements gérés par la base ; liste : erreurs visibles, badge démo | `reports/new`, `reports` |
| D | `api-gateway` réécrit : identité issue du jeton, listes blanches de filtres, transitions par rôle, agent vérifié, notifications limitées au propriétaire | `api-gateway/index.ts` |
| E IA | `ai-service` : **appel réel** à l'API Anthropic (classification de signalement → JSON validé, relecture humaine requise, délai d'attente, quotas, erreurs 429/502/504), « IA non configurée » sans clé ; prévisions = **statistiques étiquetées « non IA »** sur mesures réelles uniquement, 422 si < 12 points ; plus aucune série aléatoire | `ai-service`, `dashboard/ai/page.tsx` |
| F IoT | Authentification par appareil (`X-Device-Id`/`X-Device-Key`, hash SHA-256, comparaison à temps constant), plages physiques par métrique, rejet > 24 h / futur, limite de débit, rejeu bloqué ; simulation isolée (`IOT_SIMULATION_ENABLED`, lignes `is_simulated`, exclues des KPI et de l'IA) | `iot-ingest`, page IoT |
| G Rôles/UX | Bandeau « DONNÉES DE DÉMONSTRATION — SIMULATION » sur 13 dashboards ; citoyen : alertes/graphique réels, météo fictive retirée ; admin : sondes réelles des fonctions ; assistant renommé « réponses prédéfinies » | pages concernées |
| H | Garde-fous statiques (`npm run test`), README/SETUP mis à jour | `tests/`, docs |

## 3. Encore simulé / non réel
- Les 13 dashboards listés restent **illustratifs** (bandeau visible) : les brancher sur des indicateurs réels demande des définitions métier (sources, formules) non fournies.
- Seeds SIG/IoT/incidents : conservés mais marqués démo.
- Photo des signalements : retirée du formulaire (aucun stockage n'existait).

## 4. Bloqué par une configuration ou une dépendance externe
- Classification IA : nécessite `GEMINI_API_KEY` + `AI_MODEL` (non fournis) — fournisseur migré vers Google Gemini, voir docs/GEMINI_SETUP.md.
- Capteurs réels : aucun appareil physique ; l'ingestion est prête mais **non testée avec du matériel**.
- Prise en charge par une administration partenaire : à organiser (aucune intégration inventée).
- Calcul d'itinéraire : non implémenté (non requis).

## 5. Résultats exacts des tests
| Contrôle | Commande | Résultat |
|---|---|---|
| Garde-fous statiques (6 tests) | `node --test tests/static-guards.test.mjs` | **6/6 réussis** |
| Syntaxe TS/TSX (120 fichiers app/components/lib/hooks) | `typescript.transpileModule` | **0 erreur de syntaxe** |
| Syntaxe des 6 fichiers Edge (`_shared`, 5 fonctions) | idem | **0 erreur de syntaxe** |
| `npm install`, `tsc --noEmit`, ESLint, `next build` | — | **NON EXÉCUTÉ** (pas de réseau) |
| Application de 022 sur PostgreSQL, tests RLS multi-identités | — | **NON EXÉCUTÉ** (pas de base) |
| Fonctions Edge sous Deno, appel réel du fournisseur IA | — | **NON EXÉCUTÉ** |
| Parcours navigateur | — | **NON EXÉCUTÉ** |

À exécuter par vous, dans l'ordre : `npm ci && npx tsc --noEmit && npm run lint && npm run build` ; `supabase db push` sur une base de **préproduction** ; scénarios RLS (citoyen A ne lit pas le signalement de B ; un `government` ne peut pas changer un rôle ; un citoyen ne peut pas insérer `status='resolved'` ; télémétrie anonyme refusée) ; déploiement des fonctions puis tests décrits dans SETUP §4 bis.

## 6. Risques résiduels
- 022 non testée : la lire et la jouer d'abord en préproduction. Le trigger `reports_before_update` impose le graphe de statuts : toute donnée existante en statut hors graphe n'est pas touchée, mais ses prochaines transitions le seront.
- Les politiques RLS de 016/021 non relues en entier pour les 20+ tables de domaine ; vérifier avec `audit-posture`.
- Des comptes `@smartcity-rdc.cd` avec `demo1234` peuvent exister sur vos environnements : lancer `rotate_demo_passwords.sql` ou les supprimer. **Si une base accessible publiquement a eu ces comptes, considérez-les comme compromis.**
- `export-reports` limité à 1000 lignes ; aucun jeton de rafraîchissement spécifique n'a été audité côté Supabase Auth (réglages du dashboard : limites de débit, confirmation e-mail).
- Les tuiles `tile.openstreetmap.org` sont soumises à la politique d'usage OSM : prévoir un fournisseur dédié en production.
- Les types de lignes (`is_demo`, etc.) ne sont pas dans `lib/types` générés : régénérer les types Supabase si vous en utilisez.

## 7. Procédure de démonstration
1. Préproduction Supabase → `supabase db push` → secrets (SETUP §4 bis) → déployer les fonctions.
2. Créer l'admin (SETUP §4), optionnellement `provision-demo`, mot de passe communiqué hors dépôt.
3. Citoyen : créer un signalement avec position (clic sur la carte) → il apparaît sur la carte ; admin/agent : valider → assigner → résoudre ; le citoyen voit le statut et la notification.
4. `/dashboard/ai` : classer ce signalement (clé IA requise) ; montrer le message « IA non configurée » en retirant la clé.
5. `/dashboard/iot` : montrer « 0 appareil réel », puis la simulation étiquetée.

## 8. Preuves à préparer pour le concours
Captures de la carte avec un signalement réel ; export de `report_events` d'un dossier complet ; réponse JSON brute de `/ai-service/classify-report` + ligne `ai_predictions` ; requête 401 de `/iot-ingest/ingest` sans clé et 201 avec clé ; sortie des tests RLS ; journal de build ; liste des secrets déclarés (noms seulement) ; document précisant quelles pages sont illustratives.
