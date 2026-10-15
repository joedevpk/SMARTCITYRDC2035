-- ============================================================
-- 024 — Pièces jointes (photos) des signalements
-- Additive, idempotente, NON destructive. Dépend de : reports (002), is_staff() (022), schéma storage (Supabase).
-- Modèle : bucket PRIVÉ « report-attachments », chemin  <reporter_id>/<report_id>/<uuid>.<ext>
--          table  report_attachments  = registre des fichiers (propriétaire, type, taille).
-- Limites : 5 Mo / fichier, JPEG-PNG-WebP, 3 fichiers max par signalement.
-- ============================================================

-- 1. Bucket privé (public = false : aucune URL publique ; accès par URL signée courte durée)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-attachments', 'report-attachments', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- 2. Registre
CREATE TABLE IF NOT EXISTS public.report_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  uploaded_by   uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path  text NOT NULL UNIQUE,
  mime_type     text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  size_bytes    integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- le chemin doit être <uploaded_by>/<report_id>/<fichier> : empêche d'associer un fichier à un autre dossier
  CONSTRAINT report_attachments_path_shape CHECK (
    storage_path ~ ('^' || uploaded_by::text || '/' || report_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
  )
);
CREATE INDEX IF NOT EXISTS idx_report_attachments_report ON public.report_attachments(report_id);

ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;

-- Quota : 3 photos maximum par signalement
CREATE OR REPLACE FUNCTION public.report_attachments_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
BEGIN
  IF (SELECT count(*) FROM public.report_attachments WHERE report_id = NEW.report_id) >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 photos par signalement' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_report_attachments_limit ON public.report_attachments;
CREATE TRIGGER trg_report_attachments_limit BEFORE INSERT ON public.report_attachments
  FOR EACH ROW EXECUTE FUNCTION public.report_attachments_limit();

-- Politiques (lecture : propriétaire du signalement ou personnel ; écriture : propriétaire, signalement encore « pending »)
DROP POLICY IF EXISTS "attachments_select" ON public.report_attachments;
CREATE POLICY "attachments_select" ON public.report_attachments FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_staff()
         OR EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.reporter_id = auth.uid()));

DROP POLICY IF EXISTS "attachments_insert_owner" ON public.report_attachments;
CREATE POLICY "attachments_insert_owner" ON public.report_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid()
              AND EXISTS (SELECT 1 FROM public.reports r
                          WHERE r.id = report_id AND r.reporter_id = auth.uid() AND r.status = 'pending'));

DROP POLICY IF EXISTS "attachments_delete_owner" ON public.report_attachments;
CREATE POLICY "attachments_delete_owner" ON public.report_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid()
         AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.status = 'pending'));

REVOKE ALL ON public.report_attachments FROM anon;
GRANT SELECT, INSERT, DELETE ON public.report_attachments TO authenticated;
GRANT ALL ON public.report_attachments TO service_role;

-- 3. Politiques Storage (objets du bucket privé uniquement)
DROP POLICY IF EXISTS "report_att_read" ON storage.objects;
CREATE POLICY "report_att_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-attachments'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff()));

DROP POLICY IF EXISTS "report_att_insert" ON storage.objects;
CREATE POLICY "report_att_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-attachments'
              AND (storage.foldername(name))[1] = auth.uid()::text
              AND EXISTS (SELECT 1 FROM public.reports r
                          WHERE r.id::text = (storage.foldername(name))[2]
                            AND r.reporter_id = auth.uid() AND r.status = 'pending'));

DROP POLICY IF EXISTS "report_att_delete" ON storage.objects;
CREATE POLICY "report_att_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-attachments'
         AND (storage.foldername(name))[1] = auth.uid()::text
         AND EXISTS (SELECT 1 FROM public.reports r
                     WHERE r.id::text = (storage.foldername(name))[2] AND r.status = 'pending'));
-- Pas de politique UPDATE : un fichier ne se modifie pas, il se supprime puis se renvoie.
