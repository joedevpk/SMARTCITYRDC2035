// Couche de compatibilité : permet d'exécuter les tests Edge (écrits pour Deno) avec Node >= 22,
// quand Deno n'est pas installé. Elle ne remplace pas `npm run test:edge` (Deno) : elle sert de contrôle local.
// Usage : node --import ./tests/deno-shim.mjs --experimental-strip-types supabase/functions/ai-service/ai-service.test.ts
import { test } from 'node:test';

const store = new Map(Object.entries(process.env));
globalThis.Deno = {
  env: {
    get: (k) => store.get(k),
    set: (k, v) => { store.set(k, String(v)); },
    delete: (k) => { store.delete(k); },
  },
  test: (name, fn) => test(name, fn),
};
