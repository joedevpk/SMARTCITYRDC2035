import type { SupabaseClient } from '@supabase/supabase-js';

export const ATTACHMENT_BUCKET = 'report-attachments';
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // identique au bucket (migration 024)
export const MAX_ATTACHMENTS = 3;

export type AllowedMime = 'image/jpeg' | 'image/png' | 'image/webp';
const EXT: Record<AllowedMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Lit des octets ASCII sans décomposition d'itérable (compatible avec la cible TypeScript es5 du projet). */
function asciiAt(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

/** Type RÉEL du fichier d'après ses premiers octets (le nom ou le type déclaré par le navigateur ne comptent pas). */
export function sniffImageMime(bytes: Uint8Array): AllowedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (
    bytes.length >= 12 &&
    asciiAt(bytes, 0, 4) === 'RIFF' &&
    asciiAt(bytes, 8, 12) === 'WEBP'
  ) return 'image/webp';
  return null;
}

export type ValidatedImage = { file: File; mime: AllowedMime };

/** Valide taille + type réel. Retourne un message d'erreur en français ou le fichier validé. */
export async function validateImage(file: File): Promise<{ ok: true; value: ValidatedImage } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: `« ${file.name} » est vide.` };
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `« ${file.name} » dépasse 5 Mo (${(file.size / 1048576).toFixed(1)} Mo).` };
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = sniffImageMime(head);
  if (!mime) return { ok: false, error: `« ${file.name} » n'est pas une image JPEG, PNG ou WebP valide.` };
  return { ok: true, value: { file, mime } };
}

export type UploadOutcome = { uploaded: number; failed: { name: string; reason: string }[]; verification: 'ok' | 'failed' | 'none' };

/**
 * Envoie les images d'un signalement DÉJÀ enregistré. Échec partiel géré : chaque fichier est indépendant ;
 * si l'inscription en base échoue après l'envoi du fichier, le fichier est supprimé (pas d'orphelin).
 */
export async function uploadReportImages(
  supabase: SupabaseClient, userId: string, reportId: string, images: ValidatedImage[],
): Promise<UploadOutcome> {
  const out: UploadOutcome = { uploaded: 0, failed: [], verification: 'none' };
  for (const { file, mime } of images) {
    const path = `${userId}/${reportId}/${crypto.randomUUID()}.${EXT[mime]}`;
    const up = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: mime, upsert: false });
    if (up.error) { out.failed.push({ name: file.name, reason: up.error.message }); continue; }
    const ins = await supabase.from('report_attachments').insert({
      report_id: reportId, storage_path: path, mime_type: mime, size_bytes: file.size,
    });
    if (ins.error) {
      await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]); // nettoyage : pas de fichier sans enregistrement
      out.failed.push({ name: file.name, reason: ins.error.message });
      continue;
    }
    out.uploaded += 1;
  }
  if (out.uploaded > 0) {
    // Contrôle serveur des octets réels (le navigateur n'est pas digne de confiance). Tant qu'il n'a pas réussi,
    // la photo reste « non vérifiée » : invisible dans la liste et jamais envoyée à Gemini.
    const v = await supabase.functions.invoke('verify-attachments', { body: { report_id: reportId } });
    const d = v.data as { verified?: number; rejected?: number; errors?: number } | null;
    if (v.error || !d) out.verification = 'failed';
    else {
      out.verification = d.errors ? 'failed' : 'ok';
      if (d.rejected) out.failed.push({ name: `${d.rejected} fichier(s)`, reason: 'refusé(s) par le contrôle serveur (contenu non conforme)' });
      out.uploaded = d.verified ?? 0;
    }
  }
  return out;
}

/** URL signée courte durée (10 min) : le bucket est privé, il n'existe aucune URL publique. */
export async function signedUrls(supabase: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(paths, 600);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const d of data) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  return map;
}
