# Déploiement sur Render

## Paramètres du service Web
- Runtime : Node 22 (`NODE_VERSION=22`, le projet exige `>=22.6`)
- Build Command : `npm ci && npm run build`
- Start Command : `npm run start` (Next.js lit `PORT` fourni par Render, écoute sur 0.0.0.0)
- Health Check Path : `/`
- Gestionnaire : npm (`package-lock.json` présent)
- `output: 'standalone'` est désactivé hors Docker (incompatible avec `next start`).

## Variables d'environnement (noms uniquement)
- `NEXT_PUBLIC_SUPABASE_URL` : URL du projet Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : clé publique (anon ou `sb_publishable_...`)
- `NEXT_PUBLIC_APP_URL` : URL publique du site
- `NEXT_PUBLIC_DEMO_MODE` : `false` en production
- `NODE_VERSION` : `22`

IMPORTANT : les `NEXT_PUBLIC_*` sont intégrées AU BUILD. Après toute modification, redéployez.
Ne mettez jamais `SUPABASE_SERVICE_ROLE_KEY` sur ce service web. Les secrets des Edge Functions (`GEMINI_API_KEY`, `ALLOWED_ORIGINS`...) se posent avec `supabase secrets set`.

## Supabase > Authentication > URL Configuration
- Site URL : URL publique du site.
- Redirect URLs : `https://<domaine>/login`, `https://<domaine>/reset-password` (+ `http://localhost:3000/**` en développement).
- `ALLOWED_ORIGINS` (Edge Functions) doit contenir l'origine du site.

## Domaine personnalisé
Render > Settings > Custom Domains : ajouter le domaine, créer le CNAME (sous-domaine) ou A/ALIAS (apex) indiqué, attendre le certificat TLS, puis mettre à jour `NEXT_PUBLIC_APP_URL`, la Site URL et les Redirect URLs, et redéployer.

## Checklist après mise en ligne
1. `/`, `/login`, `/register`, `/forgot-password` répondent 200, sans bandeau « Backend non configuré ».
2. Console navigateur sans erreur `[Supabase]`.
3. Inscription, connexion, déconnexion avec un compte test.
4. Mot de passe oublié : l'e-mail arrive et ouvre `/reset-password`.
5. Menu mobile sur téléphone réel : ouverture, Échap/fermeture, liens, pas de défilement horizontal.
6. Tableau de bord par rôle : un citoyen ne voit pas les modules administratifs ; tester la RLS avec deux comptes.
7. Envoi d'une photo de signalement (bucket privé, Edge Function `verify-attachments`).
8. Logs Render sans erreur au démarrage.
