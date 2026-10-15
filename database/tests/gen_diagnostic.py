#!/usr/bin/env python3
"""Génère database/DIAGNOSTIC_LECTURE_SEULE.sql : la liste des objets ATTENDUS est lue sur une base de référence
(chaîne de migrations 001→025 rejouée, ex. base vs_ref de verify_sql.sh). Usage : python3 gen_diagnostic.py <dbname>"""
import subprocess, sys, os
db = sys.argv[1] if len(sys.argv) > 1 else "vs_ref"
def q(sql):
    r = subprocess.run(["psql", "-tA", "-F", "\t", "-d", db, "-c", sql], capture_output=True, text=True, check=True)
    return [l.split("\t") for l in r.stdout.rstrip("\n").splitlines() if l]
def lit(x): return "'" + x.replace("'", "''") + "'"
cols = q("select table_name, column_name, data_type from information_schema.columns where table_schema='public' order by 1, ordinal_position")
funcs = q("select p.oid::regprocedure::text from pg_proc p where pronamespace='public'::regnamespace and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') order by 1")
trig = q("select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and c.relnamespace in ('public'::regnamespace) order by 1,2")
pols = q("select tablename, policyname from pg_policies where schemaname='public' order by 1,2")
mig = sorted(f.split("_")[0] for f in os.listdir(os.path.join(os.path.dirname(__file__), "..", "..", "supabase", "migrations")) if f.endswith(".sql"))
V = lambda rows: ",\n  ".join("(" + ",".join(lit(c) for c in r) + ")" for r in rows)
sql = f"""-- =====================================================================================
-- SMART CITY RDC 2035 — DIAGNOSTIC EN LECTURE SEULE                  [FICHIER GÉNÉRÉ par database/tests/gen_diagnostic.py]
-- À coller dans le SQL Editor AVANT toute réparation. Ne modifie RIEN (un seul SELECT).
-- Il compare votre base au schéma attendu (migrations 001 → 025) et renvoie une ligne par constat :
--   statut MANQUANT      = objet attendu absent       → exécuter database/REPARATION_BASE_EXISTANTE.sql
--   statut INATTENDU     = objet présent mais inconnu du dépôt (politique/trigger) → à examiner à la main
--   statut RISQUE        = configuration dangereuse connue
--   statut A_DECIDER     = lecture publique (anon) ouverte à tous : voulue ? (voir docs/AUDIT_SQL_SECURITE.md §5)
--   statut INFO / OK     = information
-- Les lignes OK ne sont pas listées (sauf résumés) pour garder le résultat lisible.
-- =====================================================================================
WITH
exp_cols(t, c, ty) AS (VALUES
  {V(cols)}),
exp_funcs(sig) AS (VALUES
  {V(funcs)}),
exp_trig(t, n) AS (VALUES
  {V(trig)}),
exp_pol(t, n) AS (VALUES
  {V(pols)}),
exp_mig(v) AS (VALUES
  {V([[m] for m in mig])}),
r AS (
  -- 1. extensions
  SELECT '01 extensions' AS section, e.extname AS item, 'INFO' AS statut,
         'schéma=' || e.extnamespace::regnamespace::text || ' version=' || e.extversion AS detail
    FROM pg_extension e WHERE e.extname IN ('postgis','pgcrypto')
  UNION ALL SELECT '01 extensions', x, 'MANQUANT', 'extension requise absente'
    FROM (VALUES ('postgis'),('pgcrypto')) v(x) WHERE NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = v.x)
  UNION ALL SELECT '01 extensions', 'postgis', 'INFO',
         'Si le schéma n''est pas "public", les fonctions doivent avoir search_path = public, extensions (migration 023)'
    WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname='postgis' AND extnamespace <> 'public'::regnamespace)
  -- 2. tables manquantes
  UNION ALL SELECT '02 tables', t, 'MANQUANT', 'table attendue absente'
    FROM (SELECT DISTINCT t FROM exp_cols) x WHERE to_regclass('public.' || quote_ident(t)) IS NULL
  -- 3. colonnes manquantes (tables présentes)
  UNION ALL SELECT '03 colonnes', e.t || '.' || e.c, 'MANQUANT', 'type attendu: ' || e.ty
    FROM exp_cols e WHERE to_regclass('public.' || quote_ident(e.t)) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=e.t AND c.column_name=e.c)
  -- 4. fonctions manquantes
  UNION ALL SELECT '04 fonctions', f.sig, 'MANQUANT', 'fonction attendue absente'
    FROM exp_funcs f WHERE to_regprocedure('public.' || f.sig) IS NULL
  -- 5. triggers manquants / inattendus
  UNION ALL SELECT '05 triggers', e.t || '.' || e.n, 'MANQUANT', 'trigger attendu absent'
    FROM exp_trig e WHERE to_regclass('public.' || quote_ident(e.t)) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_trigger g WHERE g.tgrelid = to_regclass('public.' || quote_ident(e.t)) AND g.tgname = e.n AND NOT g.tgisinternal)
  UNION ALL SELECT '05 triggers', c.relname || '.' || g.tgname, 'INATTENDU', 'trigger inconnu du dépôt'
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
   WHERE NOT g.tgisinternal AND c.relnamespace = 'public'::regnamespace
     AND NOT EXISTS (SELECT 1 FROM exp_trig e WHERE e.t = c.relname AND e.n = g.tgname)
  -- 6. politiques manquantes / inattendues
  UNION ALL SELECT '06 politiques RLS', e.t || ' :: ' || e.n, 'MANQUANT', 'politique attendue absente'
    FROM exp_pol e WHERE to_regclass('public.' || quote_ident(e.t)) IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=e.t AND p.policyname=e.n)
  UNION ALL SELECT '06 politiques RLS', p.tablename || ' :: ' || p.policyname, 'INATTENDU',
         'cmd=' || p.cmd || ' roles=' || p.roles::text || ' using=' || COALESCE(p.qual,'-') || ' check=' || COALESCE(p.with_check,'-')
    FROM pg_policies p WHERE p.schemaname='public'
     AND NOT EXISTS (SELECT 1 FROM exp_pol e WHERE e.t = p.tablename AND e.n = p.policyname)
  -- 7. RLS désactivée
  UNION ALL SELECT '07 RLS', c.relname, 'RISQUE', 'RLS désactivée sur une table de public'
    FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND NOT c.relrowsecurity
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
  -- 8. politiques trop permissives (écriture ouverte, ou lecture ouverte aux anonymes)
  UNION ALL SELECT '08 politiques permissives', p.tablename || ' :: ' || p.policyname,
         CASE WHEN p.cmd <> 'SELECT' THEN 'RISQUE' ELSE 'A_DECIDER' END,
         'cmd=' || p.cmd || ' roles=' || p.roles::text || ' (USING/CHECK = true)'
    FROM pg_policies p WHERE p.schemaname='public' AND (p.qual = 'true' OR p.with_check = 'true')
     AND (p.cmd <> 'SELECT' OR p.roles::text ~ '(anon|public)')
     AND NOT (p.tablename IN ('provinces','communes','quartiers','gis_points','iot_devices','iot_telemetry','iot_sensors') AND p.cmd = 'SELECT')
  -- 9. points précis connus
  UNION ALL SELECT '09 risques connus', 'news_articles :: public_read_news', 'RISQUE', 'brouillons lisibles par tous (corrigé par migration 023)'
    WHERE EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='news_articles' AND policyname='public_read_news')
  UNION ALL SELECT '09 risques connus', f.proc, 'RISQUE', 'fonction exécutable par anon alors qu''elle ne devrait l''être que par service_role (migration 023)'
    FROM (VALUES ('public.check_rate_limit(text,integer,integer)'),('public.log_audit_entry(uuid,text,text,uuid,jsonb,text)')) f(proc)
   WHERE to_regprocedure(f.proc) IS NOT NULL AND (has_function_privilege('anon', to_regprocedure(f.proc), 'EXECUTE')
      OR has_function_privilege('authenticated', to_regprocedure(f.proc), 'EXECUTE'))
  UNION ALL SELECT '09 risques connus', 'reports.reporter_id orphelins', 'RISQUE', o.n || ' signalement(s) dont le déclarant n''existe plus (migration 023)'
    FROM (SELECT CASE WHEN to_regclass('public.reports') IS NOT NULL AND to_regclass('public.profiles') IS NOT NULL THEN
            (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.reports rr where rr.reporter_id is not null and not exists (select 1 from public.profiles pp where pp.id = rr.reporter_id)', false, true, '')))[1]::text::int
          ELSE 0 END AS n) o WHERE o.n > 0
  UNION ALL SELECT '09 risques connus', p.proname, 'RISQUE', 'fonction PostGIS avec search_path sans « extensions » alors que PostGIS est hors de public'
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN
      ('get_devices_within_radius','get_gis_points_with_coords','get_iot_devices_with_coords','get_reports_with_coords','reports_before_insert')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname='postgis' AND extnamespace <> 'public'::regnamespace)
     AND NOT (COALESCE(p.proconfig::text,'') ~ 'extensions')
  UNION ALL SELECT '09 risques connus', 'données de démonstration', 'INFO',
         (SELECT string_agg(t || ': ' || CASE WHEN to_regclass('public.' || t) IS NULL THEN 'table absente'
                 ELSE (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.' || t, false, true, '')))[1]::text || ' ligne(s)' END, ' ; ')
            FROM (VALUES ('gis_points'),('iot_devices'),('news_articles')) v(t))
         || ' — vérifier qu''il ne s''agit pas de contenu fictif publié'
  UNION ALL SELECT '10 historique migrations', 'supabase_migrations.schema_migrations', 'INFO',
         CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL
              THEN 'table absente (base non gérée par Supabase CLI ou jamais migrée via CLI)'
              ELSE 'versions enregistrées: ' || COALESCE(h.hist, '(aucune)') END
    FROM (SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN NULL ELSE
            (xpath('/row/c/text()', query_to_xml('select string_agg(version, '','' order by version) as c from supabase_migrations.schema_migrations', false, true, '')))[1]::text END AS hist) h
  UNION ALL SELECT '10 historique migrations', m.v, 'INFO', 'version du dépôt absente de l''historique Supabase (normal si le schéma a été créé via SQL Editor ; voir docs/MIGRATIONS_GUIDE.md)'
    FROM exp_mig m, (SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN NULL ELSE
            (xpath('/row/c/text()', query_to_xml('select string_agg(version, '','') as c from supabase_migrations.schema_migrations', false, true, '')))[1]::text END AS hist) h
   WHERE h.hist IS NOT NULL AND position(m.v IN h.hist) = 0
  UNION ALL SELECT '05 triggers', 'auth.users.on_auth_user_created', 'MANQUANT', 'trigger de création de profil à l''inscription absent'
    WHERE NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created' AND NOT tgisinternal)
  -- 11. résumé
  UNION ALL SELECT '11 résumé', 'tables publiques', 'INFO', (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r')::text || ' (attendu: ' || (SELECT count(DISTINCT t) FROM exp_cols)::text || ')'
)
SELECT section, item, statut, detail FROM r ORDER BY section, statut, item;
"""
open(os.path.join(os.path.dirname(__file__), "..", "DIAGNOSTIC_LECTURE_SEULE.sql"), "w", encoding="utf-8").write(sql)
print("ok:", len(cols), "colonnes,", len(funcs), "fonctions,", len(trig), "triggers,", len(pols), "politiques,", len(mig), "migrations")
