# Rapport d'audit SQL et sécurité — 14 octobre 2026

Périmètre : `supabase/migrations/` (001 → 022 + nouvelle 023), `supabase/maintenance/`, 5 Edge Functions, requêtes PostgREST/RPC du client Next.js.
Méthode : lecture complète du code **et** exécution réelle de toutes les migrations sur PostgreSQL 16.15 + PostGIS 3.4.2 (avec un stub Supabase de test :
rôles `anon`/`authenticated`/`service_role`, `auth.uid()`, privilèges par défaut), puis tests d'exploitation avec `SET ROLE`.
Inventaire exhaustif des objets : `docs/MIGRATIONS_INVENTAIRE.md` (généré). Aucun accès à votre projet Supabase distant : son état réel reste à confirmer avec `database/DIAGNOSTIC_LECTURE_SEULE.sql`.

## 1. Migrations présentes (ordre d'exécution)

| Version | Contenu | Dépend de | Remarques |
|---|---|---|---|
| 001 | PostGIS, enum `user_role`, provinces, communes, profiles, `handle_new_user` | — | |
| 002 | reports, interventions, `report_seq`, référence auto, RLS | 001 | |
| 003 | modules métier (trafic, énergie, déchets, eau, sécurité), urgences, caméras | 001-002 | |
| 004 | gis_points, notifications, audit_log | 001 | |
| 005 | données : provinces, communes, **gis_points de démonstration** | 001, 004 | seeds non rejouables sans doublon pour gis_points |
| 006, 007 | signalements d'exemple | compte « démo » existant | sans effet si le compte n'existe pas ; risque de doublons si 006 et 007 s'appliquent toutes deux (constaté à la lecture, non exécuté) |
| 008 | `get_gis_points_with_coords` | 004 | échoue au rejeu (changement de type de retour) |
| 009 | quartiers, IoT, télémétrie, `ai_predictions`, fonctions PostGIS, realtime, **appareils/télémétrie générés avec `random()`** | 001-004, 008 | politiques et `ALTER PUBLICATION` non rejouables ; données marquées « simulées » plus tard par 022 |
| 010 | vide (historique) | — | |
| 011 | `news_articles` + **4 actualités fictives publiées** | — | non marquées démo |
| 012 | correction récursion RLS profiles | 001 | |
| 013 | mot de passe admin (pgcrypto) | 0135 logique | utilise `crypt()` avant que 0135 ne crée pgcrypto (OK sur Supabase où pgcrypto existe déjà) |
| 0135 | pgcrypto, login_attempts, security_events, api_rate_limits, api_keys, `check_rate_limit`, `log_audit_entry` | — | |
| 014 | durcissement RLS | 0135 | |
| 015 | nouveaux rôles (`ALTER TYPE … ADD VALUE`) | 001 | transaction : les valeurs ne sont pas utilisées en littéral dans la même transaction (vérifié : le script consolidé passe en transaction unique) |
| 016 | resserrement RLS | 015 | |
| 017 | mots de passe démo (opt-in) | 013 | sans effet sans opt-in |
| 018 | stabilisation (`is_admin`, RPC admin, `handle_new_user`) | 015-016 | |
| 019 | corrections récursion profiles, RPC admin | 018 | |
| 020 | `handle_new_user` (téléphone) | 018 | |
| 021 | fin du durcissement RLS | 018-020 | |
| 022 | provenance (`is_demo`/`is_simulated`), workflow signalements, identifiants IoT, RLS propriétaire-ou-personnel | 018-021 | **corrigée** (search_path PostGIS, voir F1) |
| **023** | **correctifs de cet audit** | 022 | nouvelle, additive, idempotente, non destructive |

Résultat mesuré : les 22 migrations d'origine s'appliquent sans erreur sur base vierge (PostGIS dans `public`). Rejouées une seconde fois, **008, 009 et 011 échouent** (non idempotentes) ;
c'est pourquoi la réparation est un script distinct plutôt qu'un simple rejeu.

## 2. Constats vérifiés par exécution et corrigés (migration 023 + 022 retouchée)

| # | Constat | Preuve | Correction |
|---|---|---|---|
| F1 | **La migration 022 échoue si PostGIS est dans le schéma `extensions`** (cas du dashboard Supabase, recommandé par `SETUP.md`) : `function st_y(extensions.geometry) does not exist`. Même en cas de succès, `get_devices_within_radius` et le trigger d'insertion des signalements échoueraient à l'exécution (`search_path = public`). | `ERROR` reproduit à la ligne `get_reports_with_coords` ; après correctif, insertion d'un signalement géolocalisé et RPC OK dans les deux topologies | 022 : `search_path = public, extensions` sur 4 fonctions PostGIS ; 023 : idem sur les 5 fonctions pour les bases déjà migrées. Sans effet si PostGIS est dans `public`. |
| F2 | **Journal d'audit falsifiable** : `log_audit_entry(p_actor_id, …)` (SECURITE DEFINER) exécutable par `anon`/`authenticated` → écriture dans `audit_log` avec un acteur arbitraire. Aucun code client ne l'appelle. | `select log_audit_entry('<uuid admin>','FAKE.admin_login',…)` sous `anon` : ligne insérée | `REVOKE` à `PUBLIC, anon, authenticated` ; `service_role` seul. |
| F3 | **Limiteur manipulable par un anonyme** : `check_rate_limit` exécutable par `anon` → consommation du quota d'un autre utilisateur ou d'un appareil IoT (`iot:<id>`, `ai-classify:<uid>`) et remplissage de `api_rate_limits`. | appel anonyme répété : lignes créées, quota consommé | Même `REVOKE` ; seules les Edge Functions (clé service) l'utilisent. |
| F4 | **Brouillons d'actualités lisibles par tous** (y compris anonymes) : « public_read_news » `USING (true)` (018) s'ajoute à « select_published_news » (011). La page citoyen ne filtre pas `is_published` et dépend de la RLS. | `select … where is_published=false` sous `anon` : 1 ligne | Politique supprimée ; lecture publique = articles publiés ; politique `admin_read_all_news` pour les admins. Restreint des droits, n'en élargit aucun. |
| F5 | **Références orphelines** : `reports.reporter_id` est `NOT NULL … ON DELETE SET NULL` et le trigger d'immutabilité (022) réécrit `NEW.reporter_id := OLD.reporter_id` : à la suppression d'un déclarant, l'action `SET NULL` est annulée et le signalement garde un identifiant inexistant (FK violée en silence ; un dump/restore échouerait). | suppression d'un utilisateur : signalement conservé avec l'ancien UUID, profil absent | colonne rendue nullable (intention « anonymiser »), trigger : passage à NULL autorisé **seulement** si le profil d'origine n'existe plus, orphelins existants mis à NULL. Immutabilité conservée dans tous les autres cas (testé). |
| F6 | Erreur TypeScript `app/dashboard/map/page.tsx:69` (`Set<string>` ≠ `Set<Source>`) — `tsc --noEmit` échouait. | `tsc` | `new Set<Source>(…)`. |
| F7 | Messages et configuration IA citaient `ANTHROPIC_API_KEY` | grep | migré vers `GEMINI_API_KEY` (voir `docs/GEMINI_SETUP.md`). |

Autres durcissements côté Edge Function `ai-service` : limiteur **fail-closed** sur la route payante Gemini, quota ajouté aux routes de prévision (chaque appel écrit en base), contenu citoyen traité comme donnée non fiable (injection de prompt), drapeau `persisted` (l'ancien code ignorait un échec d'enregistrement).

## 3. Contrôles d'accès vérifiés (aucun défaut constaté)

Exécutés avec `SET ROLE` sur la base complète : un citoyen ne voit que ses signalements (0 ligne pour ceux d'un autre) ; un citoyen ne lit pas `ai_predictions` (0 ligne) alors que le personnel la lit ;
un citoyen ne peut pas y écrire (refus RLS) ; un citoyen ne peut pas forcer `status`/`priority` à l'insertion (réécrits par trigger) ; les RPC d'administration refusent les non-admins.
L'Edge Function `ai-service` lit avec la clé service mais exige jeton valide + profil actif + rôle ∈ liste identique à `is_staff()` : elle n'élargit pas ce que la RLS accorde déjà (`reports` : propriétaire OU personnel).

## 4. Écarts schéma ↔ code applicatif

- Colonnes et tables lues par le client (`.from().select()`, 39 requêtes) : **toutes présentes** dans le schéma réel (vérification automatisée ; 3 alertes de mon extracteur étaient des faux positifs d'analyse de chaînes voisines).
- RPC utilisées par le client : `check_login_attempts`, `record_login_attempt`, `log_security_event`, `get_*_with_coords`, `admin_*` : présentes. `check_rate_limit` et `log_audit_entry` ne sont appelées que par les Edge Functions / SQL.
- `iot-ingest` : le commentaire d'en-tête évoque encore `iot_devices.api_key_hash` alors que le code utilise `iot_device_credentials` (commentaire périmé, comportement correct).
- Page admin : elle modifie directement `reports.status` ; le trigger de workflow (022) n'accepte que les transitions pending→validated/rejected, validated→assigned/rejected, assigned→in_progress, in_progress→resolved. Un changement hors de ces transitions sera refusé par la base (comportement voulu ; à vérifier côté interface — non testé en navigateur).
- `tests/static-guards.test.mjs` mentionnait `docs/TESTS.md`, inexistant dans le dépôt.

## 5. Constats NON corrigés (décisions à prendre)

1. `emergency_incidents` : lisible par tout utilisateur authentifié (adresse, déclarant) — n'importe qui peut créer un compte citoyen. Aucune page citoyen ne la lit (accès via `api-gateway`, personnel).
2. Lecture **anonyme** ouverte (`USING (true)`) sur les tables métier `security_patrols`, `traffic_*`, `waste_*`, `water_*`, `energy_*`, `security_cameras`… signalée `A_DECIDER` par le diagnostic ; `security_patrols` mérite une attention particulière (données opérationnelles).
3. `interventions.agent_id` et `emergency_incidents.reported_by` : même contradiction `NOT NULL`/`SET NULL` que F5, mais **sans corruption** (la suppression du profil est simplement refusée).
4. Données : 4 actualités fictives publiées (011), 18 `gis_points` (marqués `is_demo`), 87 appareils IoT simulés (marqués `is_simulated`) dans une base migrée par la chaîne d'origine. Les scripts consolidés ne les créent pas.
5. Données de référence (005) : la liste des communes de Kinshasa contient 23 entrées dont « Matonge » et « Lukunga » (qui ne sont pas des communes selon nos connaissances générales), « Limbete » (Limete) et « Kasavubu » (Kasa-Vubu), et n'inclut pas Lingwala, Maluku, Ngiri-Ngiri ; populations et coordonnées sont approximatives. **À valider avec les sources officielles avant toute publication** ; non modifié car le code référence ces noms.
6. `api_rate_limits` n'est jamais purgée (une ligne par appel) ; `check_rate_limit` compte puis insère sans verrou (dépassement marginal possible en concurrence). Faible risque ; prévoir une purge planifiée (pg_cron).
7. Les comptes démo/administrateur (013, 017, `maintenance/`) restent dans l'historique des migrations ; ils sont **exclus** des scripts consolidés.

## 6. Tests exécutés / non exécutés

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit` | **réussi** (après correction F6) |
| `next lint` | **réussi** : 0 erreur, 2 avertissements `<img>` préexistants |
| `next build` | **réussi** (44 pages) — *avec réponses Google Fonts simulées* (le bac à sable n'a pas accès à fonts.googleapis.com) ; avertissement préexistant `realtime-js` |
| `npm test` (garde-fous statiques) | **10/10** |
| `deno test` (`ai-service`, Google simulé) | **38/38** ; 3 mutations volontaires (en-tête de clé, fail-open, citoyen autorisé) détectées par les tests |
| `deno check` handler/gemini/_shared ; transpilation de toutes les Edge Functions | **réussi** (les `index.ts` des autres fonctions importent `jsr:` : type-check complet impossible hors ligne, syntaxe vérifiée) |
| 22 migrations d'origine sur base vierge | **réussi** ; rejeu : 008, 009, 011 échouent (attendu) |
| Chaîne 001→023 (une transaction par fichier), PostGIS dans `public` **et** dans `extensions` | **réussi** |
| `INSTALLATION_BASE_VIDE.sql` (transaction unique) → schéma + droits identiques à la chaîne | **réussi** (2 topologies) ; refus sur base non vide **réussi** |
| `REPARATION_BASE_EXISTANTE.sql` : base vide, base migrée avec données (2 passes), bases partielles (arrêt avant 009, 018, 022), base en état 022 avec orphelins/brouillons | **réussi** : schéma + droits identiques à la chaîne, aucune donnée perdue ou modifiée (empreintes MD5 de toutes les tables), idempotent |
| Rejeu des exploits F2/F3/F4/F5 après correctif | **refermés** |
| Scan de secrets du dépôt | aucun secret |
| **Appel réel à l'API Gemini** | **NON exécuté** (pas de clé ; sortie réseau vers Google non autorisée ici) — voir `docs/GEMINI_SETUP.md` §6 |
| **Base Supabase distante, Supabase CLI, `supabase db push`, `supabase functions deploy`** | **NON exécutés** (aucun accès) |
| Test navigateur / E2E des pages | **NON exécuté** |

Limites : PostgreSQL local ≠ Supabase (versions, extensions, rôles `supabase_admin`, GoTrue) ; le stub reproduit le strict nécessaire. Les scripts n'ont pas été exécutés dans le vrai SQL Editor ;
le comportement « une transaction par exécution » du SQL Editor est présumé (et le script est validé en transaction unique). Faites un diagnostic puis une sauvegarde avant toute réparation.
