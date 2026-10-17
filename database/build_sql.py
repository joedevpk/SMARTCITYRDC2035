#!/usr/bin/env python3
"""
Génère database/INSTALLATION_BASE_VIDE.sql et database/REPARATION_BASE_EXISTANTE.sql
À PARTIR des fichiers réels de supabase/migrations/ (aucun schéma inventé).

Usage :  python3 database/build_sql.py
Les fichiers générés ne doivent pas être édités à la main : modifiez les migrations puis relancez ce script.

Ce qui est volontairement EXCLU des scripts (données fictives / secrets / opérations sur comptes) :
  - 005 (partie gis_points)  : points SIG de démonstration (coordonnées d'exemple)
  - 006, 007                  : signalements d'exemple liés à un compte démo
  - 009 (section 13)          : appareils IoT et télémétrie générés avec random()
  - 011 (articles)            : actualités fictives publiées comme de vraies actualités
  - 013, 017                  : mots de passe de comptes démo / admin
Ces fichiers restent dans supabase/migrations/ (historique préservé) ; seul le contenu de données est omis ici.
"""
import glob, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MIG = sorted(glob.glob(os.path.join(ROOT, "supabase", "migrations", "*.sql")))
SKIP = ("_006_", "_007_", "_013_", "_017_")


def read(p):
    return open(p, encoding="utf-8").read()


def cut(s, marker, name):
    i = s.find(marker)
    if i < 0:
        sys.exit(f"build_sql: repère introuvable dans {name}: {marker!r}")
    return s[:i].rstrip() + f"\n-- [build_sql] suite de {name} (données de démonstration) volontairement omise.\n"


def once(s, old, new, name):
    if s.count(old) != 1:
        sys.exit(f"build_sql: motif attendu 1 fois dans {name}, trouvé {s.count(old)} : {old[:60]!r}")
    return s.replace(old, new)


def filtered(path):
    name = os.path.basename(path)
    s = read(path)
    if "_005_" in name:
        s = cut(s, "-- GIS Points for the interactive map", name)
    if "_009_" in name:
        s = cut(s, "-- ============================================================\n-- 13. SEED IoT DEVICES", name)
        s = once(s,
                 "ALTER PUBLICATION supabase_realtime ADD TABLE iot_telemetry;\nALTER PUBLICATION supabase_realtime ADD TABLE iot_devices;",
                 "DO $pub$ BEGIN\n"
                 "  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='iot_telemetry') THEN\n"
                 "    ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_telemetry; END IF;\n"
                 "  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='iot_devices') THEN\n"
                 "    ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_devices; END IF;\n"
                 "END $pub$;", name)
    if "_011_" in name:
        s = cut(s, "-- Seed initial articles", name)
    return s


def idempotent(s, name):
    """Rend rejouable : DROP POLICY/TRIGGER IF EXISTS avant chaque CREATE, DROP des RPC dont le type de retour change."""
    s = re.sub(r'(?m)^([ \t]*)CREATE POLICY\s+("[^"]+"|\w+)\s+ON\s+([\w."]+)',
               lambda m: f'{m.group(1)}DROP POLICY IF EXISTS {m.group(2)} ON {m.group(3)};\n{m.group(0)}', s)
    s = re.sub(r'(?m)^([ \t]*)CREATE TRIGGER\s+(\w+)\b([^;]*?)\bON\s+([\w."]+)',
               lambda m: f'{m.group(1)}DROP TRIGGER IF EXISTS {m.group(2)} ON {m.group(4)};\n{m.group(0)}', s)
    s = re.sub(r'(?m)^([ \t]*CREATE (?:UNIQUE )?INDEX )(?!IF NOT EXISTS)', r'\1IF NOT EXISTS ', s)
    for fn in ("get_gis_points_with_coords", "get_iot_devices_with_coords", "get_reports_with_coords"):
        s = re.sub(rf'(?m)^([ \t]*)CREATE OR REPLACE FUNCTION\s+(?:public\.)?{fn}\(\)',
                   lambda m: f'{m.group(1)}DROP FUNCTION IF EXISTS public.{fn}();\n{m.group(0)}', s)
    return s


def body(idem):
    out = []
    for p in MIG:
        name = os.path.basename(p)
        if any(k in name for k in SKIP):
            out.append(f"\n-- ###### {name} : OMISE (données de démonstration / comptes), voir database/build_sql.py\n")
            continue
        s = filtered(p)
        if idem:
            s = idempotent(s, name)
        out.append(f"\n-- ###### {name}\n{s.rstrip()}\n")
    return "".join(out)


INSTALL_HEAD = """-- =====================================================================================
-- SMART CITY RDC 2035 — INSTALLATION INITIALE (BASE VIDE)           [FICHIER GÉNÉRÉ — ne pas éditer]
-- Source : supabase/migrations/*.sql (001 → 026) via database/build_sql.py
--
-- ⚠ À exécuter UNIQUEMENT sur une base Supabase VIDE (nouveau projet).
--   Le script s'arrête de lui-même si public.profiles ou public.reports existent déjà.
--   Base existante ou partiellement installée → database/REPARATION_BASE_EXISTANTE.sql.
-- Contenu : schéma complet (tables, types, index, fonctions, triggers, RLS, droits) + référence géographique
--   (provinces, communes de Kinshasa : valeurs approximatives, à valider avec les sources officielles).
-- Aucune donnée de démonstration, aucun compte, aucun mot de passe, aucune clé.
-- Le SQL Editor exécute le texte en une seule transaction : en cas d'erreur, rien n'est créé.
-- ⚠ Ce script n'écrit PAS dans l'historique supabase_migrations : voir docs/MIGRATIONS_GUIDE.md.
-- =====================================================================================
DO $guard$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL OR to_regclass('public.reports') IS NOT NULL THEN
    RAISE EXCEPTION 'Base NON vide (public.profiles ou public.reports existe) : utilisez database/REPARATION_BASE_EXISTANTE.sql';
  END IF;
END
$guard$;
"""

REPAIR_HEAD = """-- =====================================================================================
-- SMART CITY RDC 2035 — RÉPARATION / MISE À NIVEAU (BASE EXISTANTE OU PARTIELLE)   [FICHIER GÉNÉRÉ — ne pas éditer]
-- Source : supabase/migrations/*.sql (001 → 026) via database/build_sql.py
--
-- Principe : rejoue la chaîne de migrations sous forme IDEMPOTENTE (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT
--   EXISTS, CREATE OR REPLACE, DROP POLICY/TRIGGER IF EXISTS avant recréation). L'état final est celui des migrations.
-- Garanties :  aucun DROP TABLE / DROP COLUMN / TRUNCATE / DELETE de données ; aucune donnée de démonstration ;
--   aucun compte ni mot de passe ; RLS jamais désactivée. Les marquages de provenance (is_demo / is_simulated)
--   ne s'appliquent qu'à la PREMIÈRE création de la colonne (comme la migration 022).
-- Effets à connaître :
--   * les politiques RLS, triggers et fonctions portant les NOMS du dépôt sont réalignés sur le dépôt
--     (une modification manuelle d'un objet du même nom est écrasée) ; les objets d'AUTRE nom ne sont pas touchés
--     → lancez d'abord database/DIAGNOSTIC_LECTURE_SEULE.sql qui les liste ;
--   * ajoute les provinces/communes de référence manquantes (ON CONFLICT DO NOTHING) ;
--   * exécution en une seule transaction par le SQL Editor : en cas d'erreur, rien n'est modifié.
-- ⚠ Faites une sauvegarde (Dashboard → Database → Backups) avant. Ce script n'écrit PAS dans l'historique des
--   migrations Supabase : voir docs/MIGRATIONS_GUIDE.md.
-- =====================================================================================
"""


def main():
    inst = INSTALL_HEAD + body(False)
    rep = REPAIR_HEAD + body(True)
    for fn, txt in (("INSTALLATION_BASE_VIDE.sql", inst), ("REPARATION_BASE_EXISTANTE.sql", rep)):
        with open(os.path.join(ROOT, "database", fn), "w", encoding="utf-8", newline="\n") as f:
            f.write(txt.rstrip() + "\n")
        print(f"écrit database/{fn}  ({txt.count(chr(10))} lignes)")


if __name__ == "__main__":
    main()
