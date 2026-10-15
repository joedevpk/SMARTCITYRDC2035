# Configuration de Google Gemini (Edge Function `ai-service`)

La classification des signalements (`POST /ai-service/classify-report`) appelle **réellement** l'API Google Gemini
(`generateContent`). Les prévisions (`/predict/*`), la détection d'anomalies et l'analyse d'incidents restent des
**calculs statistiques déterministes** : ils ne passent pas par Gemini et ne sont pas présentés comme de l'IA générative.

## 1. Secrets requis (côté serveur uniquement)

| Secret | Obligatoire | Rôle |
|---|---|---|
| `GEMINI_API_KEY` | oui | Clé créée dans Google AI Studio (https://aistudio.google.com/apikey). Envoyée dans l'en-tête `x-goog-api-key`, **jamais** dans l'URL. |
| `AI_MODEL` | oui | Identifiant exact du modèle Gemini (ex. `gemini-…`). **Aucune valeur par défaut** : les noms de modèles évoluent et un nom périmé donnerait une erreur 404. Un préfixe `models/` est toléré. |
| `AI_TIMEOUT_MS` | non | Délai d'appel (borné 1000 – 60000 ms, défaut 20000). |

Ne jamais placer la clé dans le dépôt, `.env.example`, une variable `NEXT_PUBLIC_*` ou le navigateur.

```bash
supabase secrets set GEMINI_API_KEY="<votre-clé>" AI_MODEL="<identifiant-modèle>"
supabase secrets unset ANTHROPIC_API_KEY        # ancien secret, devenu inutile
supabase functions deploy ai-service
```

## 2. Choisir et vérifier le modèle

1. Consultez la liste officielle : https://ai.google.dev/gemini-api/docs/models
2. Vérifiez qu'il est **disponible pour votre clé** et qu'il supporte `generateContent` :
   ```bash
   curl -s -H "x-goog-api-key: $GEMINI_API_KEY" "https://generativelanguage.googleapis.com/v1beta/models" \
     | grep -o '"name": "models/[^"]*"'
   ```
3. Reportez l'identifiant (sans `models/`) dans `AI_MODEL`.

## 3. Ce que fait l'appel

- `POST https://generativelanguage.googleapis.com/v1beta/models/{AI_MODEL}:generateContent`
- Corps : `systemInstruction` (consignes), `contents` (le signalement, sérialisé en JSON = **donnée non fiable**),
  `generationConfig` = `{ temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" }`.
- Seuls titre, description et adresse (tronqués) sont envoyés. **Aucune identité du déclarant** n'est transmise.
- La réponse est validée strictement : JSON valide, `category` ∈ {traffic, waste, lighting, water, power, security, road, other},
  `priority` ∈ {low, medium, high, critical}, `summary` et `recommendation` non vides, `facts` et `assumptions` = tableaux de textes.
  Tout champ manquant ou hors liste ⇒ rejet (HTTP 502, **rien n'est enregistré**). Aucune valeur n'est inventée par défaut.
- La suggestion est enregistrée dans `ai_predictions` (`model = report_classification`, `features = {provider:"gemini", model, is_llm:true, requested_by}`)
  et renvoyée avec `requires_human_review: true` et `persisted: true|false`. **Un humain doit valider** : la catégorie/priorité du signalement n'est jamais modifiée automatiquement.

## 4. Codes de réponse

| Situation | HTTP | `error` |
|---|---|---|
| Clé ou modèle absent / modèle au nom invalide | 503 | `ai_not_configured` (champ `missing` = noms des secrets manquants) |
| Clé refusée (Google renvoie 400 `API_KEY_INVALID`, 401 ou 403) | 502 | `ai_provider_auth` |
| Quota Google dépassé (429) | 429 | `ai_quota_exceeded` |
| Modèle inexistant (404) | 502 | `ai_model_unavailable` |
| Paramètre refusé par Google (autre 400) | 502 | `ai_provider_rejected` |
| Google indisponible (5xx) | 503 | `ai_provider_unavailable` |
| Pas de réponse dans le délai | 504 | `ai_provider_timeout` |
| Réseau / DNS | 502 | `ai_provider_unreachable` |
| Réponse HTTP illisible / vide / bloquée par le filtre de sécurité | 502 / 502 / 422 | `ai_provider_unreadable` / `ai_empty_response` / `ai_content_blocked` |
| Sortie du modèle non JSON ou hors schéma | 502 | `ai_invalid_model_output` |
| Quota interne (20 classifications/heure/utilisateur) dépassé **ou limiteur indisponible** | 429 | — |

`GET /ai-service/status` indique `llm_configured`, `provider` (`"gemini"`), `model` et la liste `missing`/`invalid` (noms uniquement, jamais de valeurs).

## 5. Droits d'accès (inchangés)

Jeton Supabase valide + profil actif + rôle ∈ {admin, government, ministry, province, commune, agent} (même liste que `public.is_staff()`).
Citoyens et rôles de service (police, etc.) : 403 sur toutes les routes. Le limiteur est **fail-closed** sur la route payante (Gemini) :
s'il est indisponible, l'appel est refusé plutôt que laissé illimité. Les routes statistiques (60 appels/heure/utilisateur) restent fail-open.

## 6. Test réel à effectuer (non exécuté dans cet environnement)

Les 38 tests automatisés (`npm run test:edge`) simulent Google : ils prouvent la logique, **pas** que Google accepte votre clé et votre modèle.
Après déploiement :

```bash
# 1. statut (jeton d'un compte du personnel)
curl -s "$SUPABASE_URL/functions/v1/ai-service/status" -H "Authorization: Bearer $USER_JWT" -H "apikey: $SUPABASE_ANON_KEY"
# attendu : {"llm_configured":true,"provider":"gemini","model":"…","missing":[],…}

# 2. classification d'un signalement existant
curl -s -X POST "$SUPABASE_URL/functions/v1/ai-service/classify-report" \
  -H "Authorization: Bearer $USER_JWT" -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"report_id":"<uuid>"}'
# attendu : 200 + suggestion + requires_human_review:true + persisted:true
```
Si Google répond 400 `INVALID_ARGUMENT` sur `responseMimeType`, le code `ai_provider_rejected` apparaît dans la réponse et le détail dans
les journaux de la fonction (`supabase functions logs ai-service`) : ajustez alors `generationConfig` dans `gemini.ts`.

## 7. Confidentialité

Le texte des signalements est transmis à Google. Vérifiez les conditions d'utilisation de l'API Gemini applicables à votre niveau
(gratuit ou payant : le traitement des données par Google peut différer) et informez les citoyens dans la politique de confidentialité.
