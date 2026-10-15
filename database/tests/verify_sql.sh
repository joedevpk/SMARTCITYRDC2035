#!/usr/bin/env bash
# Vérifie les deux scripts consolidés contre la chaîne de migrations réelle, sur PostgreSQL+PostGIS jetables.
# Usage (en tant qu'utilisateur pouvant se connecter en superuser, ex. postgres) :  bash database/tests/verify_sql.sh
# Option POSTGIS_SCHEMA=extensions pour tester la topologie « PostGIS activé depuis le dashboard ».
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
PSQL="${PSQL:-psql}"; PGS="${POSTGIS_SCHEMA:-public}"
INST="$ROOT/database/INSTALLATION_BASE_VIDE.sql"; REP="$ROOT/database/REPARATION_BASE_EXISTANTE.sql"
fail=0; ok(){ echo "  [OK]    $*"; }; ko(){ echo "  [ÉCHEC] $*"; fail=1; }

newdb(){ # nom [postgis_schema]
  $PSQL -q -d postgres -c "DROP DATABASE IF EXISTS $1" -c "CREATE DATABASE $1" >/dev/null 2>&1
  $PSQL -v ON_ERROR_STOP=1 -q -d "$1" -f "$HERE/supabase_stub.sql" >/dev/null 2>&1
  $PSQL -q -d "$1" -c "ALTER DATABASE $1 SET search_path = \"\$user\", public, extensions" >/dev/null
  if [ "$PGS" = "extensions" ]; then $PSQL -q -d "$1" -c "CREATE EXTENSION postgis WITH SCHEMA extensions" >/dev/null; fi
}
chain(){ # db [dernier_numéro_inclus_motif]
  for f in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
    $PSQL -v ON_ERROR_STOP=1 -q -1 -d "$1" -f "$f" >/dev/null 2>/tmp/vs_err || { echo "chaîne: échec $f"; grep -m3 ERROR /tmp/vs_err; return 1; }
    if [ -n "${2:-}" ] && [[ "$f" == *"$2"* ]]; then return 0; fi
  done
  return 0
}
run(){ $PSQL -v ON_ERROR_STOP=1 -q -1 -d "$1" -f "$2" >/dev/null 2>/tmp/vs_err; }
dump(){ pg_dump -s -d "$1" --no-owner --no-privileges -n public 2>/dev/null | grep -vE '^(--|SET |SELECT pg_catalog.set_config|.restrict|.unrestrict)' | sed '/^$/d'; }
grants(){ $PSQL -tA -d "$1" -c "select p.oid::regprocedure||' anon='||has_function_privilege('anon',p.oid,'EXECUTE')||' auth='||has_function_privilege('authenticated',p.oid,'EXECUTE')||' svc='||has_function_privilege('service_role',p.oid,'EXECUTE') from pg_proc p where pronamespace='public'::regnamespace and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') order by 1"; }
snap(){ $PSQL -tA -d "$1" -c "select string_agg(t||'='||c, ',' order by t) from (select relname t,(xpath('/row/c/text()',query_to_xml(format('select md5(string_agg(x::text,'''' order by x::text)) as c from public.%I x',relname),false,true,'')))[1]::text c from pg_class where relnamespace='public'::regnamespace and relkind='r') s"; }
same(){ if diff -q <(dump "$1") <(dump "$2") >/dev/null && diff -q <(grants "$1") <(grants "$2") >/dev/null; then ok "$3"; else ko "$3 (schémas/droits différents)"; diff <(dump "$1") <(dump "$2") | head -15; diff <(grants "$1") <(grants "$2") | head -10; fi; }

echo "== topologie PostGIS dans : $PGS"
echo "== REF : chaîne de migrations 001→025 (une transaction par fichier)"
newdb vs_ref; chain vs_ref && ok "chaîne appliquée" || ko "chaîne"

echo "== S1 : INSTALLATION_BASE_VIDE.sql sur base vide (une seule transaction)"
newdb vs_inst; run vs_inst "$INST" && ok "installation sans erreur" || { ko "installation"; grep -m3 ERROR /tmp/vs_err; }
same vs_ref vs_inst "S1 schéma+droits == chaîne"
echo "   provinces: $($PSQL -tA -d vs_inst -c 'select count(*) from provinces'), communes: $($PSQL -tA -d vs_inst -c 'select count(*) from communes'), gis_points: $($PSQL -tA -d vs_inst -c 'select count(*) from gis_points'), iot_devices: $($PSQL -tA -d vs_inst -c 'select count(*) from iot_devices'), news: $($PSQL -tA -d vs_inst -c 'select count(*) from news_articles'), comptes: $($PSQL -tA -d vs_inst -c 'select count(*) from auth.users')"
run vs_inst "$INST" 2>/dev/null && ko "S1b : l'installation ne doit PAS se rejouer sur base non vide" || { grep -q "Base NON vide" /tmp/vs_err && ok "S1b garde-fou base non vide" || ko "S1b message inattendu"; }

echo "== S2 : REPARATION sur base vide"
newdb vs_rep0; run vs_rep0 "$REP" && ok "réparation sur base vide" || { ko "réparation sur base vide"; grep -m3 ERROR /tmp/vs_err; }
same vs_ref vs_rep0 "S2 schéma+droits == chaîne"

echo "== S3 : REPARATION sur base migrée AVEC DONNÉES, deux fois"
newdb vs_full; chain vs_full
$PSQL -q -d vs_full >/dev/null <<'SQL'
insert into auth.users(id,email) values ('00000000-0000-4000-8000-0000000000a1','cit@test'),('00000000-0000-4000-8000-0000000000b1','agent@test');
update profiles set role='agent' where id='00000000-0000-4000-8000-0000000000b1';
insert into reports(category,title,description,reporter_id,location) values
 ('waste','R1','description assez longue','00000000-0000-4000-8000-0000000000a1', ST_SetSRID(ST_MakePoint(15.3,-4.3),4326)),
 ('road','R2','description assez longue','00000000-0000-4000-8000-0000000000a1', null);
insert into news_articles(title,content,is_published) values ('Brouillon','x',false),('Publié','y',true);
insert into iot_devices(device_id,name,type,location,status) values ('REAL-1','capteur réel','air_sensor',ST_SetSRID(ST_MakePoint(15.3,-4.3),4326),'online');
insert into notifications(user_id,title,message,type) values ('00000000-0000-4000-8000-0000000000a1','t','m','info');
SQL
B=$(snap vs_full); GB=$(grants vs_full | wc -l)
run vs_full "$REP" && ok "réparation (passe 1)" || { ko "réparation passe 1"; grep -m3 ERROR /tmp/vs_err; }
A1=$(snap vs_full)
run vs_full "$REP" && ok "réparation (passe 2, idempotence)" || { ko "réparation passe 2"; grep -m3 ERROR /tmp/vs_err; }
A2=$(snap vs_full)
[ "$B" = "$A1" ] && ok "aucune donnée modifiée/perdue (empreintes de toutes les tables identiques)" || ko "données modifiées"
[ "$A1" = "$A2" ] && ok "passe 2 identique à la passe 1" || ko "passe 2 diffère"
same vs_ref vs_full "S3 schéma+droits == chaîne"
echo "   réel conservé: iot_devices.is_simulated(REAL-1)=$($PSQL -tA -d vs_full -c "select is_simulated from iot_devices where device_id='REAL-1'")"

echo "== S4 : REPARATION sur bases PARTIELLES (chaîne arrêtée avant 009 / 018 / 022)"
for stop in _008_ _016_ _021_; do
  newdb vs_part; chain vs_part "$stop" || ko "préparation partielle $stop"
  run vs_part "$REP" && ok "partielle jusqu'à $stop → réparée" || { ko "partielle $stop"; grep -m3 ERROR /tmp/vs_err; }
  same vs_ref vs_part "S4($stop) schéma+droits == chaîne"
done
echo "== S5 : base à l'état 022 (avant correctifs 023) avec données à risque → réparation → failles refermées"
newdb vs_s5; chain vs_s5 "_022_"
$PSQL -q -d vs_s5 >/dev/null <<'SQL'
insert into auth.users(id,email) values ('00000000-0000-4000-8000-0000000000a1','cit@test'),('00000000-0000-4000-8000-0000000000d1','gone@test');
insert into reports(category,title,description,reporter_id) values ('waste','orphelin','description assez longue','00000000-0000-4000-8000-0000000000d1'),
                                                                   ('waste','normal','description assez longue','00000000-0000-4000-8000-0000000000a1');
delete from auth.users where id='00000000-0000-4000-8000-0000000000d1';   -- laisse un reporter_id orphelin (défaut 022)
insert into news_articles(title,content,is_published) values ('BROUILLON','x',false),('PUBLIÉ','y',true);
SQL
echo "   avant : orphelins=$($PSQL -tA -d vs_s5 -c 'select count(*) from reports r where reporter_id is not null and not exists (select 1 from profiles p where p.id=r.reporter_id)'), brouillons visibles par anon=$($PSQL -tA -d vs_s5 -c "set role anon; select count(*) from news_articles where not is_published" | tail -1)"
run vs_s5 "$REP" && ok "réparation depuis l'état 022" || { ko "réparation S5"; grep -m3 ERROR /tmp/vs_err; }
same vs_ref vs_s5 "S5 schéma+droits == chaîne"
chk(){ [ "$2" = "$3" ] && ok "$1 (=$3)" || ko "$1 (attendu $3, obtenu $2)"; }
chk "orphelins après réparation" "$($PSQL -tA -d vs_s5 -c 'select count(*) from reports r where reporter_id is not null and not exists (select 1 from profiles p where p.id=r.reporter_id)')" 0
chk "signalement orphelin conservé (anonymisé)" "$($PSQL -tA -d vs_s5 -c "select count(*) from reports where title='orphelin' and reporter_id is null")" 1
chk "signalement normal intact" "$($PSQL -tA -d vs_s5 -c "select count(*) from reports where title='normal' and reporter_id='00000000-0000-4000-8000-0000000000a1'")" 1
chk "anon ne voit plus les brouillons" "$($PSQL -tA -d vs_s5 -c "set role anon; select count(*) from news_articles where not is_published" | tail -1)" 0
chk "anon voit les articles publiés" "$($PSQL -tA -d vs_s5 -c "set role anon; select count(*) from news_articles where title='PUBLIÉ'" | tail -1)" 1
chk "anon ne peut plus appeler log_audit_entry" "$($PSQL -tA -d vs_s5 -c "set role anon; select public.log_audit_entry(null,'FAKE')" 2>&1 | grep -c 'permission denied')" 1
chk "anon ne peut plus appeler check_rate_limit" "$($PSQL -tA -d vs_s5 -c "set role anon; select * from public.check_rate_limit('iot:X',1,60)" 2>&1 | grep -c 'permission denied')" 1
chk "authenticated ne peut plus appeler check_rate_limit" "$($PSQL -tA -d vs_s5 -c "set role authenticated; select * from public.check_rate_limit('k',1,60)" 2>&1 | grep -c 'permission denied')" 1
chk "service_role peut appeler check_rate_limit" "$($PSQL -tA -d vs_s5 -c "set role service_role; select allowed from public.check_rate_limit('k',5,60)" | tail -1)" t
chk "admin: RPC encore appelable par authenticated (refus applicatif, pas de droit SQL)" "$($PSQL -tA -d vs_s5 -c "set role authenticated; select public.admin_update_user_role('00000000-0000-4000-8000-0000000000a1','admin')" 2>&1 | grep -c 'Permission denied')" 1
echo "-- ré-exécution de la suppression d'un déclarant : plus d'orphelin créé"
$PSQL -q -d vs_s5 >/dev/null <<'SQL'
insert into auth.users(id,email) values ('00000000-0000-4000-8000-0000000000d2','gone2@test');
insert into reports(category,title,description,reporter_id) values ('road','orphelin2','description assez longue','00000000-0000-4000-8000-0000000000d2');
delete from auth.users where id='00000000-0000-4000-8000-0000000000d2';
SQL
chk "suppression d'un déclarant → reporter_id NULL (plus d'orphelin)" "$($PSQL -tA -d vs_s5 -c "select count(*) from reports where title='orphelin2' and reporter_id is null")" 1
chk "immutabilité conservée : un agent ne peut pas changer reporter_id" "$($PSQL -tA -d vs_s5 -c "update reports set reporter_id='00000000-0000-4000-8000-0000000000a1' where title='orphelin2' returning reporter_id" | head -1)" ""
echo; [ $fail -eq 0 ] && echo "RÉSULTAT : TOUS LES CONTRÔLES RÉUSSIS" || echo "RÉSULTAT : ÉCHECS (voir ci-dessus)"; exit $fail
