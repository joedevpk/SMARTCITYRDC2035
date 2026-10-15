import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * IMPORTANT (Next.js) : les variables NEXT_PUBLIC_* sont remplacées par leur valeur AU MOMENT DU BUILD.
 * Elles doivent donc exister dans l'environnement de `npm run build` (sur Render : onglet Environment,
 * AVANT le déploiement), et non seulement au démarrage. Elles doivent être référencées littéralement
 * (process.env.NEXT_PUBLIC_X) : un accès dynamique (process.env[name]) n'est jamais remplacé par le bundler.
 *
 * Clé publique : l'ancienne clé « anon » ou la nouvelle clé « sb_publishable_… » sont toutes deux acceptées
 * par @supabase/supabase-js. Ne mettez JAMAIS une clé secrète serveur (« sb_secret_… » ou ancien rôle privilégié) ici.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublicKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)?.trim();

/** Détecte une clé secrète (nouveau format sb_secret_… ou ancien JWT dont le rôle n'est pas « anon »). */
function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.role === 'string' && payload.role !== 'anon' && payload.role !== 'authenticated';
  } catch {
    return false;
  }
}

function validate(): string | null {
  if (!supabaseUrl || !supabasePublicKey) {
    return 'Variables Supabase manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) doivent être définies avant le build.';
  }
  try {
    const u = new URL(supabaseUrl);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return 'NEXT_PUBLIC_SUPABASE_URL doit être une URL https:// (ou http://localhost en développement).';
    }
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL n'est pas une URL valide.";
  }
  if (isPrivilegedKey(supabasePublicKey)) {
    return 'Une clé secrète a été fournie à la place de la clé publique : retirez-la du navigateur et faites-la pivoter.';
  }
  return null;
}

const configError = validate();

/** false => l'application n'est reliée à aucun backend. L'interface doit le dire (voir layout du dashboard et connexion). */
export const isSupabaseConfigured = configError === null;
export const supabaseConfigError: string | null = configError;

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

if (configError && typeof window !== 'undefined') {
  // Message sans aucune valeur de clé.
  console.error(`[Supabase] ${configError}`);
}

/**
 * Configuré : vrai client. Non configuré : AUCUNE connexion vers une URL fictive. Le client ne se construit pas
 * et toute utilisation lève une SupabaseConfigError explicite (le build/prerender, qui n'appelle jamais le client, n'est pas cassé).
 */
export const supabase: SupabaseClient = configError
  ? (new Proxy({} as SupabaseClient, {
      get(_t, prop) {
        if (prop === 'then') return undefined; // pas un thenable
        throw new SupabaseConfigError(configError);
      },
    }))
  : createClient(supabaseUrl as string, supabasePublicKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
