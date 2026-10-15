/*
# Sample Reports & Notifications

## Purpose
Inserts sample reports, emergency incidents, and notifications for the demo
citizen account. Requires the citizen profile to exist (created via the
provision-demo edge function).

## Notes
1. Joins profiles with auth.users to find the citizen by email
2. Reports cover all workflow states
3. Safe to re-run (existence checks)
*/

DO $$
DECLARE
  v_citizen uuid;
  v_kinshasa uuid;
  v_gombe uuid;
  v_lemba uuid;
BEGIN
  SELECT p.id INTO v_citizen
  FROM profiles p JOIN auth.users u ON p.id = u.id
  WHERE u.email = 'citizen@smartcity-rdc.cd' LIMIT 1;

  SELECT id INTO v_kinshasa FROM provinces WHERE code = 'KIN' LIMIT 1;
  SELECT id INTO v_gombe FROM communes WHERE name = 'Gombe' AND province_id = v_kinshasa LIMIT 1;
  SELECT id INTO v_lemba FROM communes WHERE name = 'Lemba' AND province_id = v_kinshasa LIMIT 1;

  IF v_citizen IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM reports WHERE title = 'Lampadaire en panne' AND reporter_id = v_citizen) THEN
      INSERT INTO reports (category, title, description, status, priority, location, address, reporter_id, commune_id, province_id)
      VALUES ('lighting', 'Lampadaire en panne', 'Le lampadaire devant le bâtiment A ne fonctionne plus depuis 3 jours.',
        'in_progress', 'high', ST_SetSRID(ST_MakePoint(15.301,-4.330),4326), 'Av. du Peuple, Gombe',
        v_citizen, v_gombe, v_kinshasa);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM reports WHERE title = 'Fuite d''eau importante' AND reporter_id = v_citizen) THEN
      INSERT INTO reports (category, title, description, status, priority, location, address, reporter_id, commune_id, province_id, resolved_at)
      VALUES ('water', 'Fuite d''eau importante', 'Fuite d''eau au carrefour Kasa-Vubu, la route est inondée.',
        'resolved', 'high', ST_SetSRID(ST_MakePoint(15.295,-4.382),4326), 'R. Kasa-Vubu, Gombe',
        v_citizen, v_gombe, v_kinshasa, now() - interval '2 days');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM reports WHERE title = 'Dépôt sauvage d''ordures' AND reporter_id = v_citizen) THEN
      INSERT INTO reports (category, title, description, status, priority, location, address, reporter_id, commune_id, province_id)
      VALUES ('waste', 'Dépôt sauvage d''ordures', 'Accumulation de déchets sur le trottoir de l''avenue Kasa-Vubu.',
        'pending', 'medium', ST_SetSRID(ST_MakePoint(15.297,-4.331),4326), 'Av. Kasa-Vubu',
        v_citizen, v_gombe, v_kinshasa);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM reports WHERE title = 'Nid-de-poule sur le boulevard' AND reporter_id = v_citizen) THEN
      INSERT INTO reports (category, title, description, status, priority, location, address, reporter_id, commune_id, province_id)
      VALUES ('road', 'Nid-de-poule sur le boulevard', 'Grand nid-de-poule sur le Bd du 30 Juin, dangereux pour la circulation.',
        'assigned', 'critical', ST_SetSRID(ST_MakePoint(15.298,-4.328),4326), 'Bd du 30 Juin',
        v_citizen, v_gombe, v_kinshasa);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM reports WHERE title = 'Coupure électrique fréquente' AND reporter_id = v_citizen) THEN
      INSERT INTO reports (category, title, description, status, priority, location, address, reporter_id, commune_id, province_id)
      VALUES ('power', 'Coupure électrique fréquente', 'Coupures d''électricité répétées dans le quartier depuis 48h.',
        'validated', 'high', ST_SetSRID(ST_MakePoint(15.298,-4.375),4326), 'Lemba',
        v_citizen, v_lemba, v_kinshasa);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM emergency_incidents WHERE description = 'Agression signalée près du carrefour.') THEN
      INSERT INTO emergency_incidents (type, severity, location, address, description, status, reported_by, commune_id)
      VALUES ('security', 'high', ST_SetSRID(ST_MakePoint(15.305,-4.325),4326), 'Av. du Peuple',
        'Agression signalée près du carrefour.', 'dispatched', v_citizen, v_gombe);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM emergency_incidents WHERE description = 'Incendie dans un marché, renforts nécessaires.') THEN
      INSERT INTO emergency_incidents (type, severity, location, address, description, status, reported_by, commune_id)
      VALUES ('fire', 'critical', ST_SetSRID(ST_MakePoint(15.310,-4.350),4326), 'Bandalungwa',
        'Incendie dans un marché, renforts nécessaires.', 'active', v_citizen, v_gombe);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_citizen AND title = 'Signalement en cours') THEN
      INSERT INTO notifications (user_id, title, message, type, category)
      VALUES (v_citizen, 'Signalement en cours', 'Votre signalement "Lampadaire en panne" est en cours de traitement.', 'warning', 'Signalement');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_citizen AND title = 'Signalement résolu') THEN
      INSERT INTO notifications (user_id, title, message, type, category)
      VALUES (v_citizen, 'Signalement résolu', 'Votre signalement "Fuite d''eau importante" a été résolu.', 'success', 'Intervention');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_citizen AND title = 'Bienvenue sur SMART CITY RDC') THEN
      INSERT INTO notifications (user_id, title, message, type, category)
      VALUES (v_citizen, 'Bienvenue sur SMART CITY RDC', 'Votre compte citoyen a été créé avec succès.', 'info', 'Système');
    END IF;
  END IF;
END $$;
