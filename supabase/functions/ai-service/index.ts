import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handle } from "./handler.ts";

// Point d'entrée Edge Function. Toute la logique (et les tests) est dans handler.ts / gemini.ts.
Deno.serve(handle);
