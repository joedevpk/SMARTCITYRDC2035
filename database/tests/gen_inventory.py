#!/usr/bin/env python3
"""Génère docs/MIGRATIONS_INVENTAIRE.md (tables, colonnes, clés, index, fonctions, triggers, politiques, droits)
depuis une base de référence où la chaîne 001→025 a été rejouée. Usage: python3 gen_inventory.py <dbname>"""
import subprocess, sys, os
db = sys.argv[1] if len(sys.argv) > 1 else "vs_ref"
def q(sql):
    r = subprocess.run(["psql", "-tA", "-F", "\t", "-d", db, "-c", sql], capture_output=True, text=True, check=True)
    return [l.split("\t") for l in r.stdout.rstrip("\n").splitlines() if l]
o = []
P = o.append
P("# Inventaire du schéma SQL (migrations 001 → 025)\n")
P("> **Fichier généré** par `database/tests/gen_inventory.py` à partir du schéma obtenu en rejouant réellement toutes les migrations "
  "sur PostgreSQL 16 + PostGIS 3.4 (voir `database/tests/verify_sql.sh`). Il décrit l'état **attendu** ; l'état de VOTRE base distante se vérifie avec "
  "`database/DIAGNOSTIC_LECTURE_SEULE.sql`.\n")
ext = q("select extname, extversion from pg_extension where extname in ('postgis','pgcrypto') order by 1")
P("## Extensions requises\n\n" + "\n".join(f"- `{a}` {b} (utilisée par : {'types geometry/geography, ST_*' if a=='postgis' else 'crypt(), gen_salt(), gen_random_bytes()'})" for a, b in ext) + "\n- `plpgsql` (incluse)\n")
tabs = q("select c.relname, c.relrowsecurity, (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and not exists (select 1 from pg_depend d where d.objid=c.oid and d.deptype='e') order by 1")
P(f"## Tables ({len(tabs)})\n")
P("| Table | RLS | Politiques | Clé primaire | Clés étrangères |\n|---|---|---|---|---|")
for t, rls, np_ in tabs:
    pk = q(f"select string_agg(a.attname, ', ') from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) where c.contype='p' and c.conrelid='public.{t}'::regclass")[0][0]
    fks = q(f"select a.attname||' → '||c.confrelid::regclass||case c.confdeltype when 'c' then ' (CASCADE)' when 'n' then ' (SET NULL)' when 'r' then ' (RESTRICT)' when 'd' then ' (SET DEFAULT)' else '' end from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1] where c.contype='f' and c.conrelid='public.{t}'::regclass order by 1")
    P(f"| `{t}` | {'oui' if rls=='t' else '**non**'} | {np_} | {pk or '—'} | {'<br>'.join(f[0] for f in fks) or '—'} |")
P("\n## Colonnes, types, valeurs par défaut\n")
for t, *_ in tabs:
    P(f"### `{t}`\n\n| Colonne | Type | NULL | Défaut |\n|---|---|---|---|")
    for c, ty, nl, df in q(f"select column_name, case when data_type='USER-DEFINED' then udt_name else data_type end, is_nullable, coalesce(column_default,'') from information_schema.columns where table_schema='public' and table_name='{t}' order by ordinal_position"):
        P(f"| `{c}` | {ty} | {'oui' if nl=='YES' else 'non'} | {('`'+df.replace('|','\\|')+'`') if df else ''} |")
    chk = q(f"select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.{t}'::regclass and contype in ('c','u') order by 1")
    if chk: P("\nContraintes CHECK / UNIQUE : " + " ; ".join(f"`{n}` {d.replace('|','\\|')}" for n, d in chk))
    P("")
P("## Types énumérés\n")
for n, v in q("select t.typname, string_agg(e.enumlabel, ', ' order by e.enumsortorder) from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typnamespace='public'::regnamespace group by 1 order by 1"):
    P(f"- `{n}` : {v}")
P("\n## Index (hors clés primaires)\n")
for t, n, d in q("select tablename, indexname, indexdef from pg_indexes where schemaname='public' and indexname not like '%_pkey' order by 1,2"):
    P(f"- `{t}` · `{n}` — `{d.split(' USING ',1)[-1] if ' USING ' in d else d}`")
P("\n## Fonctions SQL\n\n| Fonction | Retour | SECURITY | search_path | anon | authenticated | service_role |\n|---|---|---|---|---|---|---|")
for sig, ret, sd, cfg, a, au, sv in q("select p.oid::regprocedure, pg_get_function_result(p.oid), case when p.prosecdef then 'DEFINER' else 'invoker' end, coalesce(array_to_string(p.proconfig,','),'—'), has_function_privilege('anon',p.oid,'EXECUTE'), has_function_privilege('authenticated',p.oid,'EXECUTE'), has_function_privilege('service_role',p.oid,'EXECUTE') from pg_proc p where pronamespace='public'::regnamespace and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') order by 1::text"):
    yn = lambda x: 'oui' if x == 't' else 'non'
    P(f"| `{sig}` | {ret.replace('|','\\|')} | {sd} | `{cfg}` | {yn(a)} | {yn(au)} | {yn(sv)} |")
P("\n## Triggers\n")
for t, n, d in q("select c.relnamespace::regnamespace||'.'||c.relname, g.tgname, regexp_replace(pg_get_triggerdef(g.oid), '^CREATE (CONSTRAINT )?TRIGGER \\S+ ', '') from pg_trigger g join pg_class c on c.oid=g.tgrelid where not g.tgisinternal and c.relnamespace in ('public'::regnamespace,'auth'::regnamespace) order by 1,2"):
    P(f"- `{t}` · `{n}` — {d}")
P("\n## Politiques RLS\n\n| Table | Politique | Commande | Rôles | USING | WITH CHECK |\n|---|---|---|---|---|---|")
for t, n, cmd, roles, ql, wc in q("select tablename, policyname, cmd, roles::text, replace(coalesce(qual,''),E'\n',' '), replace(coalesce(with_check,''),E'\n',' ') from pg_policies where schemaname='public' order by 1,2"):
    esc = lambda x: ('`' + x.replace('|', '\\|').replace('\n', ' ') + '`') if x else ''
    P(f"| `{t}` | `{n}` | {cmd} | {roles} | {esc(ql)} | {esc(wc)} |")
P("\n## Publication Realtime\n")
for (t,) in q("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by 1"): P(f"- `{t}`")
open(os.path.join(os.path.dirname(__file__), "..", "..", "docs", "MIGRATIONS_INVENTAIRE.md"), "w", encoding="utf-8").write("\n".join(o) + "\n")
print("ok", len(o), "lignes")
