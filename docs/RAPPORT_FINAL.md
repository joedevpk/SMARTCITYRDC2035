# Rapport de livraison — 2026-10-15

Ce rapport complète `AUDIT_REPORT.md` (2026-10-14). Il ne reprend que ce qui a changé dans cette session et les statuts réels.

## Contexte d'exécution (honnêteté)
Environnement de la session : Node 22 + Python 3 uniquement. **Pas d'accès réseau** (donc pas de `npm ci`), **pas de PostgreSQL, pas de Deno, pas de projet Supabase, pas de clé Gemini.**

## Ajouts de cette session
| Sujet | Contenu | Statut |
|---|---|---|
| Photos de signalement | Migration 024 (bucket privé, 5 Mo, JPEG/PNG/WebP, 3 max, RLS table + storage), `lib/report-attachments.ts` (octets réels, nettoyage des orphelins), formulaire avec aperçu/retrait, miniatures en URL signées 10 min dans la liste | **CORRIGÉ MAIS NON TESTÉ SUR L'ENVIRONNEMENT RÉEL** (logique pure testée sous Node ; SQL et Storage non exécutés) |
| Gemini multimodal | `ai-service/classify-report` télécharge côté serveur les photos du bucket privé (clé service), les envoie en `inlineData`, sépare `observed_in_images` / `facts` / `assumptions`, annonce `images.analyzed / failed` | **CORRIGÉ MAIS NON TESTÉ SUR L'ENVIRONNEMENT RÉEL** (requête vérifiée avec un faux `fetch` ; aucun appel Google réel) |
| SQL consolidé | `INSTALLATION_BASE_VIDE.sql` et `REPARATION_BASE_EXISTANTE.sql` régénérés avec 024 | **NON EXÉCUTÉ** |
| CI | Node 22 (requis par `npm test`) | non exécuté |

## Résultats exacts des tests
| Commande | Résultat |
|---|---|
| `npm test` (garde-fous statiques + images/Gemini, Node 22) | **18/18 réussis** |
| `node --experimental-strip-types --check` sur `gemini.ts`, `handler.ts`, `ai-service.test.ts`, `lib/report-attachments.ts` | syntaxe valide (pas une vérification de types) |
| Tests Deno `ai-service.test.ts` (4 tests ajoutés pour les images) | **NON EXÉCUTÉ** (pas de Deno) |
| `npm ci`, `tsc --noEmit`, `npm run lint`, `next build` | **NON EXÉCUTÉ** (pas de réseau) |
| Migrations 001→025 sur PostgreSQL (PostGIS `public` / `extensions`), tests RLS | **NON EXÉCUTÉ** |
| Parcours navigateur, responsive 320→430 px | **NON EXÉCUTÉ** |

## Toujours simulé / non terminé
- 13 tableaux de bord : illustratifs, bandeau « DONNÉES DE DÉMONSTRATION » visible. Les brancher sur des indicateurs réels exige des définitions métier (sources, formules) que vous devez fournir : **décision métier requise**, non prise à votre place.
- Capteurs réels : aucun appareil testé.
- Audit responsive et accessibilité : **non réalisé** dans cette session (pas de navigateur).
- Pages `/partners`, `/legal`, textes institutionnels : non relus ligne à ligne ; vérifiez qu'aucun partenaire n'y est présenté sans accord écrit.

## Verdict
**Le projet n'est PAS déclaré prêt pour la production** : les migrations 022, 023, 024 n'ont pas été rejouées dans cet environnement, le build et l'authentification n'ont pas été exécutés. Exécutez d'abord la section « À exécuter par vous » ci-dessous.

## À exécuter par vous (ordre recommandé)
1. `npm ci && npx tsc --noEmit && npm run lint && npm run build`
2. `npm test` (Node ≥ 22.6) puis `deno test --allow-env supabase/functions/ai-service/`
3. Préproduction Supabase : `supabase db push --dry-run`, puis `supabase db push` (022→024). Diagnostic préalable : `database/DIAGNOSTIC_LECTURE_SEULE.sql`.
4. Tests RLS : le citoyen A ne lit pas les photos du citoyen B ; un fichier hors `<son id>/<report_id>/` est refusé ; `anon` ne lit rien dans `report-attachments` ; photo impossible sur un signalement non `pending`.
5. `supabase secrets set GEMINI_API_KEY=… AI_MODEL=…` puis déployer `ai-service`, classer un signalement **avec photo**, vérifier `images.analyzed = 1`.
6. Régénérer les types Supabase (nouvelle table `report_attachments`).

## Checklist de mise en production (résumé)
- [ ] Étapes 1 à 6 ci-dessus au vert
- [ ] Comptes `demo1234` supprimés ou mot de passe roté (`supabase/maintenance/rotate_demo_passwords.sql`)
- [ ] `NEXT_PUBLIC_DEMO_MODE=false`, `ALLOW_DEMO_PROVISIONING=false`, `IOT_SIMULATION_ENABLED=false`
- [ ] `ALLOWED_ORIGINS` = domaine réel uniquement ; URL de redirection Auth configurées
- [ ] Fournisseur de tuiles de production (OSM public déconseillé en charge)
- [ ] Sauvegardes Supabase + test de restauration ; surveillance des journaux des fonctions


---
# Mise à jour — passe de validation du 2026-10-15 (2e session)

## Environnement réel de cette passe
`npm ci` tenté : **échec** (registre npm inaccessible : « Exit handler never called », aucun paquet installé). Donc **NON EXÉCUTÉ** : `npx tsc --noEmit`, `npm run lint`, `npm run build`. Également absents : Deno (`npm run test:edge` NON EXÉCUTÉ), PostgreSQL/Supabase CLI (migrations, RLS, Storage NON EXÉCUTÉS), navigateur (responsive, parcours de bout en bout NON EXÉCUTÉS), clé Gemini (test réel NON EXÉCUTÉ — clé ou environnement indisponible).

## Défaut démontré par lecture et corrigé : validation des fichiers contournable
Constat : en 024, le contrôle des octets n'existait que dans le navigateur. Un client pouvait envoyer directement à Storage (en-tête `image/jpeg`) n'importe quel contenu, puis le faire envoyer à Gemini.
Correction (migration **025** + Edge Function **`verify-attachments`**) :
- colonne `report_attachments.verified` (défaut `false`) ; un client ne peut pas l'insérer à `true` (politique) ni la modifier (aucun UPDATE) ; seule la clé service peut la poser ;
- `verify-attachments` (authentifiée, réservée au **déclarant**, limitée à 60/h, refus si le limiteur est en panne) télécharge chaque fichier, contrôle les **octets réels** = type déclaré et ≤ 5 Mo ; conforme → `verified=true` ; non conforme → fichier **et** ligne supprimés ; panne Storage transitoire → ni validé ni supprimé, réessai possible ;
- la liste n'affiche que les photos vérifiées ; `ai-service` ne lit que `verified=true` **et** re-contrôle les octets avant l'envoi à Gemini ;
- si la vérification n'aboutit pas, le formulaire l'annonce (pas de confirmation mensongère ; le signalement reste enregistré).
Stratégie de compensation : signalement d'abord, puis fichiers ; échec d'inscription d'un fichier → fichier supprimé ; fichier non conforme → supprimé par le serveur.
Limite restante : un fichier non conforme reste brièvement dans le bucket privé (invisible, non servi) jusqu'à la vérification ; un utilisateur qui n'appelle jamais la fonction laisse des fichiers non vérifiés (à purger par tâche planifiée : **non implémentée**).

## Résultats exacts
| Commande | Résultat |
|---|---|
| `npm test` (Node 22) | **20/20 réussis** (dont 3 nouveaux : sniff Edge, garde 025, garde 024/photos) |
| `node --experimental-strip-types --check` (handlers Edge, lib) | syntaxe valide (≠ vérification de types) |
| `python3 database/build_sql.py` | scripts régénérés avec 024 et 025 (2949 / 3135 lignes) |
| Tests Deno `ai-service.test.ts` (6 tests images ajoutés au total) | **NON EXÉCUTÉ** |
| `npm ci` | **ÉCHEC** (réseau) |

## Contrôles des phases demandées — statut
| Contrôle | Statut |
|---|---|
| Vérification serveur des photos (025) | CORRIGÉ MAIS NON TESTÉ SUR L'ENVIRONNEMENT RÉEL |
| Photos : bucket privé, RLS, URL signées | CORRIGÉ MAIS NON TESTÉ SUR L'ENVIRONNEMENT RÉEL |
| Gemini multimodal | CORRIGÉ MAIS NON TESTÉ SUR L'ENVIRONNEMENT RÉEL |
| Migrations 001→025, scripts consolidés, historique | NON EXÉCUTÉ (aucune base) ; 025 reste à vérifier avec le diagnostic en lecture seule |
| Build / TypeScript / ESLint | NON EXÉCUTÉ |
| Auth, RLS multi-rôles, parcours de bout en bout | NON EXÉCUTÉ |
| Carte (tuiles, couches, GPS) | PARTIELLEMENT OPÉRATIONNEL (code revu, non vu dans un navigateur) |
| 13 tableaux de bord | SIMULÉ OU NON CONNECTÉ (bandeau démo visible) |
| IoT avec appareil réel | SIMULÉ OU NON CONNECTÉ |
| Responsive 320→430 px, accessibilité | NON EXÉCUTÉ |

## Déploiement : ajouts
- `supabase functions deploy verify-attachments` (en plus de `ai-service`, `api-gateway`, `iot-ingest`, `export-reports`) ; `ALLOWED_ORIGINS` doit contenir votre domaine.
- Ordre : `supabase db push` (…→024→025) **avant** de déployer l'application, sinon le formulaire appelle une fonction/colonne absente.
- Retour arrière : 024/025 sont additives ; revenir à la version précédente de l'application suffit (les photos déjà stockées restent privées).

## Problèmes résiduels
1. Aucune purge planifiée des pièces non vérifiées / orphelines.
2. Types Supabase à régénérer (`report_attachments`).
3. Tests RLS/Storage multi-identités à écrire et exécuter sur une base réelle (liste dans la section précédente).
4. Dépendances : `npm audit` non exécuté ; Next 13.5.1 est ancien, vérifier ses avis de sécurité.

## DÉCISION
**NON PRÊT** — ni pour la production, ni pour la préproduction « validée » : build, migrations, RLS/Storage et Gemini réel n'ont produit aucun résultat observable. Prêt à être **soumis** à une préproduction pour exécuter la séquence de la section précédente (étapes 1 à 6) plus le déploiement de `verify-attachments`.
