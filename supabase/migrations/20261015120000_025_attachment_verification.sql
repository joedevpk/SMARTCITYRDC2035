-- ============================================================
-- 025 — Vérification serveur des pièces jointes
-- Additive, idempotente, non destructive. Dépend de 024.
-- Le navigateur n'est pas digne de confiance : un fichier n'est exploitable (affiché, envoyé à Gemini)
-- qu'une fois verified = true, posé UNIQUEMENT par l'Edge Function verify-attachments (clé service)
-- après contrôle des octets réels du fichier stocké.
-- ============================================================
ALTER TABLE public.report_attachments ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.report_attachments ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Un client ne peut pas s'auto-déclarer « vérifié »
DROP POLICY IF EXISTS "attachments_insert_owner" ON public.report_attachments;
CREATE POLICY "attachments_insert_owner" ON public.report_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND verified = false AND verified_at IS NULL
              AND EXISTS (SELECT 1 FROM public.reports r
                          WHERE r.id = report_id AND r.reporter_id = auth.uid() AND r.status = 'pending'));

-- Aucun UPDATE pour authenticated (déjà le cas en 024) ; on le garantit explicitement.
REVOKE UPDATE ON public.report_attachments FROM anon, authenticated;
GRANT UPDATE (verified, verified_at) ON public.report_attachments TO service_role;
