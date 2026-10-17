# Rapport de correction — Validation humaine des suggestions Gemini

Projet : SMART CITY RDC 2035 · Date : 17 octobre 2026 · Périmètre : module IA (`ai-service`), page `app/dashboard/ai`

> **À lire en premier — ce qui a été vérifié et ce qui ne l'a pas été.**
> L'environnement de travail n'avait ni `node_modules`, ni accès réseau, ni PostgreSQL, ni Deno.
> **Exécuté et réussi** : 27 tests Node existants (`npm test`) + 7 garde-fous statiques ajoutés, et 64 tests Edge (44 existants + 20 nouveaux) exécutés **via une couche de compatibilité Node** (`tests/deno-shim.mjs`), pas sous Deno.
> **Écrit mais NON exécuté** : la migration 026 et son script de test SQL (`database/tests/test_ai_decisions.sql`), le typecheck (`tsc`), ESLint, `next build`, `deno test`.
> **Rien n'a été déployé ni exécuté sur une base distante.** Les étapes à faire avant déploiement sont en section 7.

---

## 1. Audit (phase 1)

**Fichiers réellement utilisés** : `app/dashboard/ai/page.tsx`, `supabase/functions/ai-service/{handler,gemini,index}.ts`, `supabase/functions/_shared/http.ts`, `supabase/functions/api-gateway/index.ts` (référence pour les rôles), migrations 002, 009, 022, 023.

**Fonctionnement initial**
- `POST /classify-report` appelle Gemini, valide la sortie (`parseSuggestion`), enregistre dans `ai_predictions` et renvoie le texte. Aucune action de validation n'existait.
- Authentification : jeton Supabase vérifié par `authenticate()`, profil actif, rôle dans `STAFF_ROLES` (`admin, government, ministry, province, commune, agent`), identique à `public.is_staff()`.
- `reports` : enums `report_category` (8 valeurs) et `report_priority` (`low, medium, high, critical`) ; trigger `update_updated_at` ; trigger de workflow de statut (022/023) ; RLS : lecture propriétaire ou personnel, `UPDATE` pour le personnel.
- `ai_predictions` : écriture réservée au service (022). `audit_log` et `report_events` existent.

**Lacunes constatées qui bloquaient la fonctionnalité**
1. L'`INSERT` dans `ai_predictions` ne renvoyait pas l'`id` : impossible de rattacher une décision à une suggestion.
2. Aucune table d'historique des décisions.
3. Aucun endpoint de lecture d'une suggestion avec les valeurs *actuelles* du signalement.

**État initial des tests** : `npm test` 20/20 ; tests Edge **43/44** — 1 échec **préexistant** (assertion obsolète : le handler écrit `images_analyzed` depuis l'ajout de l'analyse d'images, le test ne le prévoyait pas ; corrigée, voir §4). Typecheck/lint/build : non exécutables ici.

**Risque résiduel identifié (non traité, voir §6)** : le personnel peut déjà modifier `reports.priority` directement (politique RLS `agent_update_report`, route `PUT /reports/:id` de `api-gateway`), hors de ce nouveau workflow.

## 2. Plan minimal (phase 2)

| Fichier | Nature |
|---|---|
| `supabase/migrations/20261017100000_026_ai_suggestion_decisions.sql` | **Nouveau** — table d'historique + fonction SQL atomique (migration additive) |
| `supabase/functions/ai-service/decisions.ts` | **Nouveau** — routes de lecture/décision/historique |
| `supabase/functions/ai-service/handler.ts` | +13 lignes, 0 supprimée : id de suggestion + 3 routes |
| `components/dashboard/ai-suggestion-review.tsx` | **Nouveau** — interface de validation |
| `app/dashboard/ai/page.tsx` | +26 / −3 : intégration, historique, repli |

Aucune réécriture, aucune suppression de route/page/composant, modèle Gemini et secrets inchangés, RLS jamais désactivée, anciennes migrations intactes.

## 3. Sauvegarde (phase 3)

Le dossier reçu n'était pas un dépôt Git. Une copie intacte a été conservée avant toute modification et sert de référence de comparaison (aucun travail utilisateur écrasé). Fichiers modifiés : liste exacte en §5.

## 4. Ce qui a été implémenté

### Interface (page IA)
- Deux blocs distincts : **Valeurs actuellement enregistrées** (catégorie, priorité, statut) et **Suggestion de Gemini** (catégorie, priorité, résumé, faits, hypothèses, recommandation, nom du modèle, nombre d'images analysées).
- **Accepter** : cases « Appliquer la catégorie / la priorité » (seuls les champs cochés sont appliqués ; un champ identique à l'existant est grisé), dialogue de confirmation avec récapitulatif avant/après, commentaire facultatif.
- **Modifier** : listes déroulantes alimentées par le serveur (catégories/priorités réellement autorisées), récapitulatif avant confirmation.
- **Rejeter** : confirmation, aucune valeur modifiée, la suggestion complète reste consultable avec la décision, l'auteur et la date.
- Boutons à état de chargement et désactivés pendant l'envoi, messages de réussite/erreur (`role="status"` / `role="alert"`), libellés associés aux champs, navigation clavier (composants Radix du projet), responsive (grille 1 → 2 colonnes).
- Historique des analyses : badge **À valider / Acceptée / Modifiée / Rejetée** et bouton **Consulter** pour rouvrir une suggestion.
- Si la suggestion n'a pas pu être enregistrée (`prediction_id` nul), l'ancien affichage est conservé avec un avertissement : elle ne peut pas être validée.

### Backend (`ai-service`)
- `POST /classify-report` renvoie désormais `prediction_id` (champ ajouté, `current` inchangé pour ne rien casser).
- `GET /suggestions/:id` : suggestion (re-validée par `parseSuggestion`), valeurs actuelles du signalement, décision éventuelle, listes autorisées, droit de baisser une priorité selon le rôle.
- `POST /suggestions/:id/decision` : `accept | modify | reject`.
- `GET /decisions` : dernières décisions.
- Identité de l'acteur **toujours issue du jeton**, jamais du corps ; la suggestion appliquée vient **toujours de la base**, jamais du client.
- Si la migration 026 n'est pas appliquée : réponse explicite (503 `decisions_unavailable`), suggestion toujours consultable, aucune erreur 500.

### Base de données (migration 026, additive)
- Table `ai_suggestion_decisions` : suggestion, signalement, décision, suggestion proposée, valeurs précédentes et finales, champs réellement appliqués, baisse de priorité, utilisateur, rôle, horodatage, commentaire, copie de la suggestion (aucun secret), modèle, clé d'idempotence.
- Contraintes : **une décision par suggestion** (`UNIQUE`), `request_id` unique, un rejet ne peut pas porter de valeurs modifiées (`CHECK`), historique **en ajout seul** (trigger bloquant les `UPDATE`).
- RLS : lecture réservée au personnel (`is_staff()`), **aucune politique d'écriture**, droits retirés à `anon`/`authenticated`.
- Fonction `apply_ai_suggestion_decision()` (`SECURITY DEFINER`, `search_path` épinglé, exécutable par `service_role` uniquement) : une seule transaction pour mise à jour du signalement + historique + `audit_log` ; une erreur en cours de route annule tout.

### Sécurité (réponses aux exigences)
| Exigence | Mise en œuvre |
|---|---|
| Utilisateurs non autorisés | Contrôle Edge (`STAFF_ROLES`) **et** refait en SQL (profil actif + rôle) |
| `critical` jamais abaissée automatiquement | `classify` n'écrit rien dans `reports` (testé) ; toute baisse exige rôle habilité (`admin, government, ministry, province`) **et** confirmation explicite, vérifiés côté serveur et en SQL. Les rôles `agent` et `commune` ne peuvent **pas** baisser une priorité |
| Modifications concurrentes | Verrous de ligne + comparaison des valeurs lues (catégorie, priorité, `updated_at`) → `report_changed` (409), rien n'est appliqué |
| Doubles clics / requêtes répétées | Garde synchrone dans l'interface, `request_id` idempotent (rejeu → même décision, sans second effet), `UNIQUE(prediction_id)` |
| Données invalides / réponses incorrectes du modèle | Validation stricte des entrées ; suggestion stockée re-validée à chaque lecture ; enums vérifiés en SQL |
| Erreurs réseau | Message explicite, nouvelle tentative sans risque de doublon (même `request_id`) |
| Pas de clé privilégiée côté navigateur | Vérifié par garde-fou existant + nouveau garde-fou |

## 5. Fichiers modifiés / créés

**Créés** : `supabase/migrations/20261017100000_026_ai_suggestion_decisions.sql`, `supabase/functions/ai-service/decisions.ts`, `supabase/functions/ai-service/decisions.test.ts`, `components/dashboard/ai-suggestion-review.tsx`, `database/tests/test_ai_decisions.sql`, `tests/deno-shim.mjs`, ce rapport.

**Modifiés** : `app/dashboard/ai/page.tsx` (+26/−3), `supabase/functions/ai-service/handler.ts` (+13/−0), `supabase/functions/ai-service/ai-service.test.ts` (+2/−1 : assertion obsolète), `tests/static-guards.test.mjs` (+84, 7 tests), `package.json` (+1 script `test:edge:node`), `database/build_sql.py` (texte « 001 → 026 »), `database/INSTALLATION_BASE_VIDE.sql` et `database/REPARATION_BASE_EXISTANTE.sql` (**régénérés** : seule la migration 026 est ajoutée, plus la ligne d'en-tête ; le générateur a été vérifié comme reproduisant à l'identique les fichiers d'origine avant régénération).

## 6. Tests et résultats

| Vérification | Résultat | Remarque |
|---|---|---|
| `npm test` (guards statiques + images) | **27/27 ✔** | dont 7 nouveaux garde-fous 026 |
| Tests Edge `ai-service` | **64/64 ✔** | **via Node + `tests/deno-shim.mjs`**, pas sous Deno ; 44 existants + 20 nouveaux |
| Test de mutation (3 casses volontaires du code) | chaque casse détectée par ≥ 1 test | identité lue dans le corps ; validation `modify` retirée ; `classify` qui applique la priorité |
| `database/tests/test_ai_decisions.sql` | **NON exécuté** | couvre acceptation, modification, rejet, non-autorisés, critique, double soumission, conflit, **atomicité (panne simulée)**, persistance, RLS/droits |
| `tsc --noEmit`, `next lint`, `next build`, `deno test` | **NON exécutés** | `node_modules`/Deno indisponibles ; relecture manuelle faite (hooks, types, dépendances d'effets) |

Les 20 tests Edge couvrent : accès (401/403), entrées invalides, identité issue du jeton, transmission verbatim de `updated_at` (précision microseconde), double soumission, 12 codes d'échec SQL → HTTP, panne SQL/réseau, migration absente, quota, lecture et rôles, suggestion hors schéma, `prediction_id`.

**Limites à connaître** : les tests Edge utilisent une base simulée — ils ne prouvent pas la logique SQL (atomicité, verrous, concurrence), d'où le script SQL à exécuter. Le comportement visuel (rendu, responsive, clavier) n'a pas été testé dans un navigateur.

**Risques résiduels / décisions à prendre**
1. **Modifications directes hors workflow** : la politique RLS `agent_update_report` et `PUT /reports/:id` (api-gateway) permettent toujours à tout le personnel de changer `reports.priority`, y compris de baisser une priorité critique. Je n'y ai pas touché (hors périmètre, risque de casser des usages existants). Recommandation : un trigger/une politique limitant la baisse de priorité aux mêmes rôles, après validation métier.
2. **Liste des rôles habilités à baisser une priorité** (`admin, government, ministry, province`) : choix de ma part, modifiable à deux endroits (`LOWER_PRIORITY_ROLES` dans `decisions.ts` et `v_lower_roles` dans la migration) ; un test vérifie qu'ils restent identiques. À faire valider.
3. **Détection de conflit** : repose sur `updated_at` (mis à jour par le trigger existant). Toute modification du signalement (même un changement de statut) invalide une suggestion lue avant — comportement voulu, à confirmer en recette.
4. **Inventaire** `docs/MIGRATIONS_INVENTAIRE.md` : généré depuis une base réelle, **non régénéré** (PostgreSQL indisponible). À relancer avec `database/tests/gen_inventory.py`.

## 7. Étapes avant déploiement (rien n'a été déployé)

1. **Sauvegarde** de la base (Dashboard → Database → Backups).
2. Sur une base **jetable** : `bash database/tests/run_migrations_local.sh` puis `psql -v ON_ERROR_STOP=1 -d smartcity_test -f database/tests/test_ai_decisions.sql` — attendu : `TOUS LES TESTS SQL 026 : OK`. Corriger si un test échoue.
3. En local avec dépendances : `npm ci && npm run typecheck && npm run lint && npm run build && npm test && npm run test:edge` (Deno).
4. Appliquer **la migration 026 seule** sur l'environnement de test/préproduction, avec votre autorisation.
5. Déployer `ai-service` : `supabase functions deploy ai-service`. Ordre recommandé : **migration → fonction → front**. Le front reste compatible si la fonction n'est pas encore à jour (ancien affichage de repli).
6. Recette manuelle : analyser un signalement `waste/critical` ; vérifier les trois actions ; essayer en `agent` de baisser la priorité (refusé) puis en `admin` (confirmation exigée) ; double-cliquer sur « Confirmer » ; modifier le signalement dans un autre onglet puis décider (conflit attendu) ; vérifier `ai_suggestion_decisions` et `audit_log`.
7. Régénérer l'inventaire SQL (point 4 ci-dessus), puis déployer en production avec votre autorisation explicite.

**Retour arrière** : la migration est additive ; les commandes de rollback sont en tête du fichier SQL (supprimer la table supprime l'historique des décisions — à ne faire que volontairement). Le front se rétablit en restaurant `page.tsx`.
