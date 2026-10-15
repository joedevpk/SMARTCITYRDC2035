# Guide pas à pas : secrets, migrations, déploiement

> Aucune de ces commandes n'a été exécutée contre **votre** projet Supabase (aucun accès). Elles ont été validées uniquement sur
> PostgreSQL 16 + PostGIS local (voir `docs/AUDIT_SQL_SECURITE.md` §6).

## 0. Avant tout
- Sauvegardez : Dashboard → Database → Backups (ou `supabase db dump -f sauvegarde.sql`).
- Installez la CLI : https://supabase.com/docs/guides/cli ; `supabase login` ; `supabase link --project-ref <ref>`.

## 1. Connaître l'état réel de la base distante (lecture seule)
1. Collez `database/DIAGNOSTIC_LECTURE_SEULE.sql` dans le SQL Editor → **Run**. Il ne modifie rien.
   - `MANQUANT` : objet attendu absent → réparation nécessaire.
   - `RISQUE` : configuration dangereuse connue (corrigée par la migration 023).
   - `INATTENDU` : objet inconnu du dépôt (jamais supprimé automatiquement : examinez-le).
   - `A_DECIDER` : lecture publique volontaire ? (voir audit §5).
2. Historique des migrations : `supabase migration list` (compare local ↔ distant) ou, en SQL :
   `select version, name from supabase_migrations.schema_migrations order by version;`

## 2. Choisir le chemin
| Situation | Chemin |
|---|---|
| Nouveau projet vide | **A** (CLI) ou **B1** (SQL Editor) |
| Base gérée par la CLI, historique synchronisé | **A** : `supabase db push` n'applique que les migrations manquantes (dont 023) |
| Base créée/modifiée à la main, historique absent ou différent, ou partiellement installée | **B2** (réparation) puis éventuellement §4 |

### A. Supabase CLI (recommandé, conserve l'historique)
```bash
supabase db push --dry-run     # liste ce qui serait appliqué, sans rien faire
supabase db push
```
Prérequis PostGIS : l'extension peut être activée depuis le dashboard (schéma `extensions`) **ou** par la migration 001 (schéma `public`) ;
les deux sont gérées depuis la migration 023 / la 022 corrigée. Ne passez pas `--include-all` sans avoir lu `--dry-run`.

### B1. SQL Editor — base vide : `database/INSTALLATION_BASE_VIDE.sql`
Se bloque d'elle-même si `public.profiles` ou `public.reports` existe. Exécutée en une transaction : une erreur n'installe rien.

### B2. SQL Editor — base existante/partielle : `database/REPARATION_BASE_EXISTANTE.sql`
Idempotente, sans suppression de données, sans démo ni compte. Relire l'en-tête du fichier (effets : réalignement des politiques/triggers/fonctions
de **mêmes noms** que le dépôt). Relancez ensuite le diagnostic : il ne doit plus afficher de `MANQUANT` ni de `RISQUE`.
Ces fichiers sont **générés** (`python3 database/build_sql.py`) : ne les éditez pas, modifiez les migrations puis régénérez.

## 3. Historique des migrations : éviter la divergence
Un script exécuté dans le SQL Editor **n'écrit pas** dans `supabase_migrations.schema_migrations`. Conséquence : la CLI croira les migrations
« non appliquées » et tentera de les rejouer au prochain `db push` (la plupart ne sont pas rejouables : 008, 009, 011 échouent).
Règles :
1. Ne modifiez jamais une migration déjà appliquée sur la base distante (la 022 a été corrigée dans le dépôt : sans effet là où elle est déjà appliquée ; la 023 compense).
2. Ne marquez **pas** toutes les migrations comme appliquées « pour que ça passe ».
3. Procédure justifiée après un B2 : pour **chaque** version dont vous avez vérifié (diagnostic propre) que les effets sont présents :
   ```bash
   supabase migration repair --status applied <version>      # une version à la fois
   supabase migration list                                    # local et distant doivent concorder
   ```
   Les versions omises du script (006, 007, 013, 017 : données/comptes de démonstration) n'ont **pas** été exécutées : ne les marquez appliquées
   que si vous acceptez qu'elles ne le soient jamais sur cette base.
4. Après réalignement, toute évolution suit `supabase migration new` + `supabase db push`.

## 4. Secrets des Edge Functions
```bash
supabase secrets set ALLOWED_ORIGINS="https://votre-domaine.tld"
supabase secrets set GEMINI_API_KEY="<clé>" AI_MODEL="<modèle>"      # voir docs/GEMINI_SETUP.md
supabase secrets unset ANTHROPIC_API_KEY
supabase secrets list                                                  # vérifier les noms (les valeurs ne sont pas affichées)
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement aux fonctions.

## 5. Déploiement des fonctions
`_shared/http.ts` a changé (option `failOpen` du limiteur) : redéployez **toutes** les fonctions.
```bash
supabase functions deploy            # toutes
# ou : supabase functions deploy ai-service api-gateway iot-ingest export-reports provision-demo
supabase functions logs ai-service
```

## 6. Vérifications après déploiement
1. Diagnostic SQL : aucun `MANQUANT` / `RISQUE`.
2. `GET /ai-service/status` puis `POST /ai-service/classify-report` (voir `docs/GEMINI_SETUP.md` §6).
3. Compte citoyen : `POST /ai-service/classify-report` → 403 ; lecture de `ai_predictions` → 0 ligne.
4. Anonyme : `GET /rest/v1/news_articles?is_published=eq.false` → `[]` ; `POST /rest/v1/rpc/check_rate_limit` → 401/403/permission denied.

## 7. Rejouer les tests localement
```bash
npm ci && npm run typecheck && npm test            # TypeScript + garde-fous statiques
npm run test:edge                                  # Deno : 38 tests de ai-service (Google simulé)
# SQL (PostgreSQL + PostGIS locaux, rôle superuser) :
bash database/tests/verify_sql.sh                              # PostGIS dans public
POSTGIS_SCHEMA=extensions bash database/tests/verify_sql.sh    # PostGIS dans extensions
```
`database/tests/supabase_stub.sql` imite Supabase **uniquement pour ces tests** : ne jamais l'exécuter sur un vrai projet.


## Migration 024 — pièces jointes (ajoutée le 2026-10-15)
`20261015090000_024_report_attachments.sql` : bucket **privé** `report-attachments`, table `report_attachments`, politiques RLS sur la table et sur `storage.objects`.
- Additive et idempotente ; dépend de 002 (`reports`), 022 (`is_staff()`) et du schéma `storage` fourni par Supabase.
- `database/tests/supabase_stub.sql` fournit désormais un schéma `storage` minimal pour les tests locaux.
- Statut : **écrite, NON EXÉCUTÉE** (aucun PostgreSQL dans l'environnement de cette session). À jouer d'abord en préproduction : `supabase db push --dry-run` puis `supabase db push`.
- Si vous utilisez le SQL Editor : régénérez avec `npm run build:sql` (déjà fait dans cette livraison) ; le script « réparation » contient 024.
- Limite connue : le contrôle du type du fichier côté Storage repose sur l'en-tête `Content-Type` envoyé ; la vérification des **octets réels** est faite dans le navigateur (`lib/report-attachments.ts`). Un client malveillant peut envoyer un autre contenu sous un type image : les fichiers ne sont jamais servis publiquement (URL signées, bucket privé) et Gemini ne reçoit que les types autorisés.


## Migration 025 — vérification serveur des pièces jointes
`20261015120000_025_attachment_verification.sql` : colonnes `verified`/`verified_at`, politique d'insertion exigeant `verified = false`, UPDATE réservé à `service_role`. Additive, idempotente, **NON EXÉCUTÉE** (aucune base disponible). Les photos déjà envoyées avec 024 passeront à `verified=false` : relancer `verify-attachments` pour chaque signalement concerné ou accepter qu'elles restent masquées.
