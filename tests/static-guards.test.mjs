// Dependency-free regression guards. Run: node --test tests/static-guards.test.mjs
// They do NOT replace runtime/RLS tests (see docs/TESTS.md) but stop the regressions found in the audit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next' || n === '.git') continue;
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};
const clientFiles = ['app', 'components', 'lib', 'hooks'].flatMap((d) => walk(d)).filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f) => readFileSync(f, 'utf8');

test('no demo password or privileged secret in browser code', () => {
  for (const f of clientFiles) {
    const src = read(f);
    assert.ok(!src.includes('demo1234'), `${f} embeds the demo password`);
    assert.ok(!/SERVICE_ROLE|service_role/.test(src), `${f} references the service role key`);
  }
});

test('no Math.random() in browser code (no fabricated operational data)', () => {
  const allow = new Set(['lib/stores/notification-store.ts']); // client-only local toast id
  for (const f of clientFiles) {
    if (allow.has(f.replaceAll('\\', '/'))) continue;
    assert.ok(!read(f).includes('Math.random'), `${f} uses Math.random`);
  }
});

test('edge functions: CORS closed by default, no synthetic fallbacks', () => {
  const shared = read('supabase/functions/_shared/http.ts');
  assert.ok(!/\?\s*"\*"\s*:/.test(shared) && shared.includes('ALLOW_ANY_ORIGIN'));
  for (const f of ['index.ts', 'handler.ts', 'gemini.ts']) assert.ok(!read(`supabase/functions/ai-service/${f}`).includes('Math.random'), `ai-service/${f} must not fabricate series`);
  const iot = read('supabase/functions/iot-ingest/index.ts');
  assert.ok(iot.includes('IOT_SIMULATION_ENABLED') && iot.includes('is_simulated: true'), 'simulation must be gated and flagged');
  assert.ok(iot.includes('timingSafeEqual'), 'device keys must be compared in constant time');
});

test('edge functions never trust identity from the request body', () => {
  const gw = read('supabase/functions/api-gateway/index.ts');
  assert.ok(!/body\.reporter_id|actor_id\s*\|\|/.test(gw));
  assert.ok(gw.includes('reporter_id: user.id'));
});

test('env files with real names are not committed', () => {
  assert.ok(!existsSync('.env.production') && !existsSync('.env.development') && !existsSync('.env'));
  assert.ok(/\.env\.production/.test(read('.gitignore')));
});

test('migrations: corrective 022 present, 013 delimiter fixed, 017 guarded', () => {
  const dir = 'supabase/migrations';
  assert.ok(readdirSync(dir).some((f) => f.includes('_022_')));
  assert.ok(!/DO \$\n/.test(read(join(dir, '20260726094606_013_seed_admin_password.sql'))));
  assert.ok(read(join(dir, '20260728171907_017_set_demo_passwords.sql.sql')).includes('app.allow_demo_passwords'));
  const m = read(join(dir, readdirSync(dir).find((f) => f.includes('_022_'))));
  for (const needle of ['is_super_admin', 'profiles_guard_privileged', 'reports_before_update', 'iot_device_credentials', 'uq_telemetry_replay'])
    assert.ok(m.includes(needle), `022 lacks ${needle}`);
});

test('ai-service uses Google Gemini only: no Anthropic leftovers, key in header (never in URL), no hard-coded key', () => {
  const files = ['index.ts', 'handler.ts', 'gemini.ts'].map((f) => `supabase/functions/ai-service/${f}`);
  const src = files.map(read).join('\n');
  assert.ok(!/anthropic|ANTHROPIC/i.test(src), 'Anthropic reference left in ai-service');
  assert.ok(src.includes('generativelanguage.googleapis.com') && src.includes('x-goog-api-key') && src.includes('GEMINI_API_KEY'));
  assert.ok(!/[?&]key=/.test(src), 'Gemini key must never travel in the URL');
  assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(src), 'hard-coded Google API key');
  assert.ok(src.includes('AI_MODEL') && !/model\s*[:=]\s*["']gemini-/.test(src), 'model must come from the AI_MODEL secret, not be hard-coded');
});

test('Gemini config is documented and never shipped: .env.example has empty GEMINI_API_KEY, no Anthropic', () => {
  const env = read('.env.example');
  assert.ok(/^GEMINI_API_KEY=\s*$/m.test(env) && /^AI_MODEL=\s*$/m.test(env));
  assert.ok(!/ANTHROPIC/i.test(env));
  assert.ok(existsSync('docs/GEMINI_SETUP.md'));
});

test('SQL deliverables: generated scripts exist, are non-destructive and carry no secret / demo account', () => {
  for (const f of ['database/INSTALLATION_BASE_VIDE.sql', 'database/REPARATION_BASE_EXISTANTE.sql']) {
    const sql = read(f).replace(/--.*$/gm, ''); // les commentaires ne comptent pas
    assert.ok(!/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDROP\s+COLUMN\b|\bDROP\s+SCHEMA\b/i.test(sql), `${f} contains a destructive statement`);
    assert.ok(!/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql), `${f} disables RLS`);
    assert.ok(!/demo1234|crypt\(\s*'/i.test(sql), `${f} embeds a password`);
    assert.ok(!/INSERT INTO (auth\.users|gis_points|iot_devices|iot_telemetry|news_articles)\b/i.test(sql), `${f} seeds demo data`);
  }
});

test('migration 023 hardening is present and non-destructive', () => {
  const sql = read('supabase/migrations/20261014090000_023_audit_hardening.sql').replace(/--.*$/gm, '');
  assert.ok(/REVOKE ALL ON FUNCTION public\.check_rate_limit/.test(sql) && /REVOKE ALL ON FUNCTION public\.log_audit_entry/.test(sql));
  assert.ok(!/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(sql));
});

test('migration 024 : bucket privé, RLS sur le registre et sur storage.objects, non destructive', () => {
  const sql = read('supabase/migrations/20261015090000_024_report_attachments.sql').replace(/--.*$/gm, '');
  assert.ok(/'report-attachments',\s*'report-attachments',\s*false/.test(sql), 'le bucket doit être privé');
  assert.ok(/ENABLE ROW LEVEL SECURITY/.test(sql) && /ON storage\.objects/.test(sql));
  assert.ok(!/TO\s+anon\b/i.test(sql.replace(/REVOKE[^;]*;/g, '')), 'aucune politique ni droit pour anon');
  assert.ok(!/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(sql));
  assert.ok(/file_size_limit/.test(sql) && /allowed_mime_types/.test(sql));
});

test('photos de signalement : validation par octets réels, aucune URL publique du bucket', () => {
  const lib = read('lib/report-attachments.ts');
  assert.ok(lib.includes('sniffImageMime') && lib.includes('createSignedUrls'));
  assert.ok(!/getPublicUrl/.test(lib + clientFiles.map(read).join('\n')), 'bucket privé : getPublicUrl interdit');
  const form = read('app/dashboard/reports/new/page.tsx');
  assert.ok(form.includes('uploadReportImages') && form.includes('validateImage'));
});

test('ai-service : l\'analyse d\'image n\'est annoncée que si des images sont réellement transmises', () => {
  const h = read('supabase/functions/ai-service/handler.ts');
  assert.ok(h.includes('inlineData') === false && h.includes('images: media.images') && h.includes('analyzed: media.images.length'));
  assert.ok(read('supabase/functions/ai-service/gemini.ts').includes('inlineData'));
});

test('025 : un client ne peut pas poser verified=true ; seule l\'Edge Function (service) le peut', () => {
  const sql = read('supabase/migrations/20261015120000_025_attachment_verification.sql').replace(/--.*$/gm, '');
  assert.ok(/verified = false/.test(sql) && /REVOKE UPDATE ON public\.report_attachments FROM anon, authenticated/.test(sql));
  assert.ok(/GRANT UPDATE \(verified, verified_at\) ON public\.report_attachments TO service_role/.test(sql));
  assert.ok(!/\bDROP\s+TABLE\b|\bTRUNCATE\b/i.test(sql));
  const h = read('supabase/functions/verify-attachments/handler.ts');
  assert.ok(h.includes('reporter_id=eq.') && h.includes('sniffImage') && h.includes('failOpen: false'));
  assert.ok(read('supabase/functions/ai-service/handler.ts').includes('verified=eq.true'));
});
