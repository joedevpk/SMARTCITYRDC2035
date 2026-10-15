# Guide de mise en route — SMART CITY RDC 2035

Ce projet est un frontend Next.js complet branché sur Supabase (base de
données PostgreSQL + authentification). **Sans un projet Supabase configuré,
l'application se lance mais aucune fonctionnalité réelle (connexion,
tableaux de bord, signalements) ne marchera** — c'est la première chose à
faire avant la présentation.

## 1. Créer le projet Supabase (5 min)

1. Allez sur https://supabase.com → New Project (le plan gratuit suffit pour
   une démo).
2. Notez l'URL du projet et les clés dans **Project Settings → API** :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ jamais côté client)
3. Activez l'extension PostGIS : **Database → Extensions → postgis** (les
   migrations l'utilisent pour les points GPS de la carte).

## 2. Appliquer les migrations (2 min)

Toutes les migrations sont dans `supabase/migrations/`, numérotées et
idempotentes. Avec la CLI Supabase :

```bash
npm install -g supabase
supabase login
supabase link --project-ref <votre-project-ref>
supabase db push
```

Sinon, ouvrez **SQL Editor** dans le dashboard Supabase et exécutez chaque
fichier de `supabase/migrations/` **dans l'ordre du nom de fichier**
(l'ordre est important : certaines migrations dépendent de fonctions créées
par les précédentes — c'est justement ce qui était cassé et qui a été
corrigé dans cette version, voir `20260726100000_0135_bootstrap_security_objects.sql`).

## 3. Configurer les variables d'environnement

```bash
cp .env.example .env.local
```

Puis éditez `.env.local` et renseignez au minimum :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

`.env.local` est déjà dans `.gitignore` — ne le commitez jamais.

## 4. Créer des comptes de démonstration

La page de connexion (`/login`) n'affiche des raccourcis d'e-mail de démonstration que si
`NEXT_PUBLIC_DEMO_MODE=true` ; **aucun mot de passe n'est embarqué**. Ces comptes ne sont pas
créés automatiquement. Deux options :

**Étape obligatoire — créer le premier admin :**
1. Créez un compte via `/register` (n'importe quel email).
2. Dans **Supabase → Table Editor → profiles**, changez la colonne `role`
   de ce compte de `citizen` à `admin`.
3. Reconnectez-vous sur `/login` avec ce compte → vous arrivez sur
   `/dashboard/admin`.

**Étape optionnelle — créer les 6 autres comptes démo automatiquement :**
Le projet inclut une edge function `provision-demo` déjà écrite pour ça
(`supabase/functions/provision-demo`). Déployez-la puis appelez-la avec le
token de l'admin créé ci-dessus :

```bash
supabase functions deploy provision-demo
# Récupérez un access_token en vous connectant depuis le navigateur
# (Application → Local Storage → rdc-auth), puis :
curl -X POST "https://<votre-projet>.supabase.co/functions/v1/provision-demo" \
  -H "Authorization: Bearer <access_token-de-l-admin>"
```

Elle crée (ou ignore si déjà existants) les 7 comptes `@smartcity-rdc.cd`
avec le mot de passe défini dans `ADMIN_SEED_PASSWORD`, et leur assigne le
bon rôle. C'est plus rapide et plus sûr que de les créer un par un dans le
dashboard.

⚠️ La fonction exige `ALLOW_DEMO_PROVISIONING=true` et `ADMIN_SEED_PASSWORD` (≥ 16 caractères) dans
les secrets (`supabase secrets set ...`). Le mot de passe n'est jamais renvoyé ni écrit dans le dépôt.
La migration 017 ne positionne plus `demo1234` sauf opt-in explicite sur une base jetable
(`app.allow_demo_passwords = 'on'`).

## 4 bis. Déployer les fonctions Edge et définir les secrets

```bash
supabase db push                                   # applique aussi 022
supabase secrets set ALLOWED_ORIGINS=https://votre-domaine
supabase secrets set GEMINI_API_KEY=... AI_MODEL=...   # optionnel : sinon « IA non configurée » — voir docs/GEMINI_SETUP.md
supabase secrets set IOT_SIMULATION_ENABLED=false         # true seulement pour une démo étiquetée SIMULATION
supabase functions deploy api-gateway ai-service export-reports provision-demo
supabase functions deploy iot-ingest --no-verify-jwt      # les appareils s'authentifient par X-Device-Id / X-Device-Key
```

Enregistrer un appareil réel : créer la ligne `iot_devices` (is_simulated = false), puis, en admin,
`POST /functions/v1/iot-ingest/devices/<uuid>/key` → la clé n'est affichée qu'une fois. L'appareil envoie
`POST /functions/v1/iot-ingest/ingest` avec `X-Device-Id`, `X-Device-Key` et `{ "metric", "value", "recorded_at" }`.

## 5. Lancer le projet

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3000.

## 6. Vérification rapide avant la présentation

- [ ] `/login` avec le compte admin redirige bien vers `/dashboard/admin`
- [ ] `/dashboard/admin` affiche des chiffres (provinces, communes,
      signalements) — si tout est à 0, c'est normal tant qu'aucune donnée
      de démo n'a été saisie manuellement (aucune donnée de seed n'existe
      par défaut au-delà des provinces/communes de la RDC)
- [ ] `/register` crée bien un nouveau compte citoyen
- [ ] `/dashboard/reports/new` permet de soumettre un signalement, visible
      ensuite dans `/dashboard/reports`
- [ ] `/dashboard/map` affiche la carte (Leaflet) sans erreur console ; les points issus du seed portent le contour pointillé « démonstration »
- [ ] `npm run test` (garde-fous statiques) passe
- [ ] `/dashboard/ai` : sans clé IA, message « IA non configurée » ; avec clé, la classification d'un signalement répond

## Ce qui a été corrigé dans cette version

Voir le message de livraison pour le détail complet. En résumé :
1. Build Next.js cassé (`useSearchParams` sans `Suspense` dans
   `app/dashboard/reports/page.tsx`)
2. Chaîne de migrations Supabase cassée sur un projet neuf (fonctions/
   tables référencées par les migrations 014/018/019 mais jamais créées) —
   nouvelle migration `20260726100000_0135_bootstrap_security_objects.sql`
3. Policies RLS grand-ouvertes sur une quinzaine de tables (n'importe quel
   utilisateur connecté pouvait modifier/supprimer des données
   d'infrastructure) — nouvelle migration
   `20260809170000_021_finish_rls_hardening.sql`
4. `Dockerfile` : ligne `COPY` invalide qui empêchait tout `docker build`
5. `Dockerfile`/`docker-compose.yml` : les variables `NEXT_PUBLIC_*`
   n'étaient passées qu'au runtime du conteneur alors que Next.js les
   intègre au moment du build — corrigé avec des `ARG`/`args:`
