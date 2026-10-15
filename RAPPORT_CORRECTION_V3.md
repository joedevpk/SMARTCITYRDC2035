# SMART CITY RDC 2035 — Rapport d'audit, correction et préparation au déploiement (15/10/2026)

Principe : ce rapport distingue ce qui a été **exécuté** de ce qui ne l'a pas été.
Environnement : Node 22.22.2, npm 10.9.7, Chromium headless (Playwright). **Aucun projet Supabase, aucune base PostgreSQL, aucun dépôt Git** (le zip ne contient pas `.git`).

## 1. Problèmes réellement trouvés
| # | Gravité | Problème | Statut |
|---|---|---|---|
| 1 | Bloquant | `lib/report-attachments.ts` : `String.fromCharCode(...bytes.slice())` → TS2802 (cible `es5`) | Corrigé |
| 2 | Bloquant | `app/globals.css` : `bg-background/85` inexistant dans Tailwind 3.3.3 → le build échouait (masqué tant que le build n'avait jamais tourné) | Corrigé |
| 3 | Bloquant (réseau) | `next/font/google` (Inter, Space Grotesk) téléchargé au build | Corrigé : polices locales |
| 4 | Important | Client Supabase : repli silencieux sur `https://not-configured.invalid` | Corrigé : erreur explicite |
| 5 | Important | Récupération de mot de passe : redirection vers `/login`, aucune page pour saisir le nouveau mot de passe | Page `/reset-password` créée |
| 6 | Important | `output: 'standalone'` incompatible avec `next start` (Render) ; Dockerfile copiait un `public/` inexistant | Corrigé |
| 7 | Important | Menu public mobile : panneau non défilable (jusqu'à ~16 sous-liens), pas d'Échap, pas de blocage du scroll, cibles de 36 px, nom de la plateforme masqué, recherche décorative (suggestions toutes vers `/dashboard`), panneau de recherche `fixed` piégé dans un parent à `backdrop-filter`, méga-menu uniquement à la souris | Corrigé |
| 8 | Important | Tableau de bord mobile : bouton menu `fixed` chevauchant la barre, `SidebarContent` redéfini à chaque rendu, `layoutId` partagé entre 2 instances, pas d'Échap/focus/aria, liste de notifications `w-80` hors écran à 320 px, bouton « supprimer » visible seulement au survol (inutilisable au toucher), recherche absente sur mobile | Corrigé |
| 9 | Important | Page d'accueil : débordement horizontal de 14 px (320–768 px) dû aux blocs animés depuis le côté | Corrigé (`overflow-x-clip`) |
| 10 | Mineur | Browserslist/caniuse-lite obsolète | Corrigé |
| 11 | Mineur | `@supabase/realtime-js` « Critical dependency » | **Non corrigé** : vient de la dépendance, non bloquant |
| 12 | Mineur | 2 avertissements lint `<img>` (profil, landing) | Non corrigés, non bloquants |

## 2. Fichiers modifiés / créés
Modifiés : `lib/report-attachments.ts`, `lib/supabase/client.ts`, `lib/hooks/use-auth-init.ts`, `app/layout.tsx`, `app/globals.css`, `app/register/page.tsx`, `app/forgot-password/page.tsx`, `app/dashboard/layout.tsx`, `components/shared/public-header.tsx`, `components/dashboard/dashboard-sidebar.tsx`, `components/dashboard/dashboard-topbar.tsx`, `components/landing/landing-features.tsx`, `components/landing/landing-map-section.tsx`, `next.config.js`, `Dockerfile`, `.env.example`, `package-lock.json` (caniuse-lite uniquement).
Créés : `app/reset-password/page.tsx`, `lib/stores/nav-store.ts`, `lib/hooks/use-overlay.ts`, `app/fonts/*` (2 woff2 + licences OFL), `.nvmrc`, `render.yaml`, `docs/DEPLOIEMENT_RENDER.md`, ce rapport.

## 3. Corrections appliquées
- **Uint8Array** : fonction `asciiAt()` (boucle) ; comportement identique ; `tsconfig` inchangé (`strict` conservé, aucun `any`/`@ts-ignore`).
- **Supabase** : lecture littérale de `process.env.NEXT_PUBLIC_*` (requise par le bundler), `trim`, validation d'URL (https ou localhost), refus d'une clé secrète (préfixe `sb_secret_` ou JWT de rôle privilégié), clé publique `ANON_KEY` ou `PUBLISHABLE_KEY`. Non configuré : `isSupabaseConfigured=false`, `supabase` est un Proxy qui lève `SupabaseConfigError` (aucune requête réseau) ; l'interface affiche déjà le bandeau « Backend non configuré ». Le prérendu du build ne touche pas le client.
- **Cause réelle du message « Supabase environment variables are missing »** : les `NEXT_PUBLIC_*` sont figées au build ; si elles ne sont pas définies sur Render *avant* le build, le bundle n'en contient aucune.
- **Polices** : Inter et Space Grotesk variables (sous-ensemble latin, accents français inclus), `next/font/local`, mêmes variables CSS, repli système.
- **Navigation** : voir §4.
- **Hébergement** : `standalone` seulement si `NEXT_OUTPUT=standalone` (Dockerfile) ; `.nvmrc` 22.

## 4. Navbar et menu mobile
Public : panneau défilable `max-h: 100dvh − barre`, cibles ≥ 44 px, `aria-expanded/controls`, `role=dialog`, Échap, piège à focus et retour du focus, scroll bloqué, fermeture au changement de page ou passage en desktop, zones sûres, nom de la plateforme visible sur mobile, boutons connexion/inscription affichés dès 768 px, états actifs (`aria-current`), méga-menu ouvrable au focus clavier, recherche réelle (filtre sans accents, Entrée → première page).
Dashboard : bouton menu dans la barre, tiroir `min(18rem, 100vw−3rem)` en `100dvh`, mêmes comportements d'accessibilité, état actif sur routes imbriquées, recherche mobile dépliable, notifications en panneau pleine largeur sur mobile, cibles 44 px.

## 5. Sécurité
Aucun secret détecté par scan (JWT, `sb_secret_`, clés Google) ni fichier `.env` réel dans l'archive ; `.gitignore` couvre `.env`, `.env*.local`, `.env.production`, `.env.development`. Garde statique `tests/static-guards.test.mjs` toujours verte. **Non audité dans cette passe** : RLS, Edge Functions, droits SQL (aucune base disponible ; voir `docs/AUDIT_SQL_SECURITE.md` existant, jamais exécuté sur une vraie base). Aucune clé n'a été changée.

## 6. Commandes exécutées et résultats exacts
- Référence : `npm ci` OK (544 paquets) ; `npm run typecheck` → 2 erreurs TS2802.
- Après correctifs : `npx tsc --noEmit` → aucune erreur ; `npm test` → 20 pass / 0 fail ; `npm run lint` → 0 erreur, 2 avertissements `<img>`.
- `npm run build` : **code 0**, 45/45 pages statiques générées, avec variables absentes et avec variables fictives. Avertissement restant : « Critical dependency » (`@supabase/realtime-js`).
- `npm run start` (port 3100) : 200 sur `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/vision`, `/contact`, `/dashboard`.
- Chromium, 9 largeurs (320, 360, 375, 390, 430, 768, 1024, 1280, 1440) × 15 pages publiques/auth : **0 débordement horizontal**.
- Chromium, menu mobile à 320/375/430/768 px : ouverture, panneau dans l'écran, scroll bloqué, cibles ≥ 44 px, Échap, retour du focus, fermeture après clic, recherche → navigation : tout OK. Méga-menu au focus clavier : OK.
- Console navigateur : seules erreurs = message `[Supabase]` attendu (variables absentes) et images `pexels.com` non chargées (pas de réseau dans le bac à sable).

## 7. Non vérifié (limites)
Connexion, inscription, réinitialisation, sessions, rôles et RLS de bout en bout (pas de Supabase) ; tiroir et barre du tableau de bord **en navigateur** (session requise : validés seulement par TypeScript, lint et build) ; pages privées aux 9 largeurs ; Edge Functions (Deno absent) ; image Docker non construite ; historique Git et secrets suivis (pas de `.git`).
Les 13 tableaux de bord de rôle restent, selon `AUDIT_REPORT.md`, alimentés par des chiffres codés en dur : non modifié ici.

## 8. Render — paramètres
Voir `docs/DEPLOIEMENT_RENDER.md` et `render.yaml`. Build : `npm ci && npm run build` ; Start : `npm run start` ; Node 22 ; health check `/`.
Variables (noms) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEMO_MODE`, `NODE_VERSION`. À définir avant le build.
Supabase : ajouter `https://<domaine>/login` et `https://<domaine>/reset-password` aux Redirect URLs.

## 9. Commandes Git à exécuter (rien n'a été poussé)
```
git status
git checkout -b fix/audit-v3
git add -A && git status        # vérifier qu'aucun .env n'apparaît
git commit -m "fix: build (Uint8Array, Tailwind), polices locales, client Supabase explicite, navigation mobile, reset-password, config Render"
git push -u origin fix/audit-v3  # puis pull request ; pas de --force
```

## 10. Checklist après mise en ligne
Voir la fin de `docs/DEPLOIEMENT_RENDER.md` (8 points). Recommandé en plus : faire pivoter toute clé qui aurait été partagée hors de Supabase/Render.
