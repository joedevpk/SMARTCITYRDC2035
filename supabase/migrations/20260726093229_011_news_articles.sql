-- News articles table for the citizen portal
CREATE TABLE IF NOT EXISTS public.news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  excerpt text,
  content text,
  category text NOT NULL DEFAULT 'info' CHECK (category IN ('government','works','traffic','weather','alert','event','info')),
  source text,
  image_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Policies: published articles are readable by everyone (anon + authenticated)
CREATE POLICY "select_published_news" ON public.news_articles
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- Only authenticated users can insert/update/delete (admins)
CREATE POLICY "insert_news_authenticated" ON public.news_articles
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_news_authenticated" ON public.news_articles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_news_authenticated" ON public.news_articles
  FOR DELETE TO authenticated USING (true);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_news_created_at ON public.news_articles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON public.news_articles (category);

-- Seed initial articles
INSERT INTO public.news_articles (title, excerpt, content, category, source) VALUES
  ('Lancement de la phase 2 du programme SMART CITY à Kinshasa', 'Le Gouvernement annonce l''extension de la plateforme à 10 nouvelles communes.', 'Dans le cadre de la transformation numérique, le Gouvernement de la RDC annonce l''extension du programme SMART CITY à 10 nouvelles communes de Kinshasa. Cette phase 2 inclut le déploiement de 2,000 capteurs IoT supplémentaires pour la gestion intelligente de l''éclairage public et des déchets.', 'government', 'Presidence de la République'),
  ('Travaux sur le Boulevard du 30 Juin — déviations recommandées', 'Des travaux de réhabilitation débutent lundi sur 3 tronçons.', 'La Mairie de Kinshasa informe les citoyens que des travaux de réhabilitation routière débuteront lundi sur le Boulevard du 30 Juin. Trois tronçons seront concernés. Des déviations sont recommandées via le Boulevard Triomphal et l''Avenue de la Justice.', 'works', 'Mairie de Kinshasa'),
  ('Alerte météo : fortes pluies attendues dans 8 provinces', 'L''ACC Congo émet une alerte pour les prochaines 48 heures.', 'L''Agence Congolaise de la Météorologie émet une alerte pour de fortes pluies dans 8 provinces du pays durant les prochaines 48 heures. Les citoyens sont invités à rester vigilants et à éviter les zones à risque d''inondation.', 'weather', 'Agence Congolaise de la Météorologie'),
  ('Festival de la Jeunesse : grande manifestation au Stade des Martyrs', 'Un événement culturel national se tiendra ce week-end.', 'Le Ministère de la Jeunesse organise un grand festival culturel au Stade des Martyrs ce samedi et dimanche. L''évènement célébrera la jeunesse congolaise avec des concerts, des expositions et des activités sportives. L''entrée est gratuite.', 'event', 'Ministère de la Jeunesse')
ON CONFLICT DO NOTHING;
