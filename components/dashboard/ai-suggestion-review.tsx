'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Pencil, ShieldAlert, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type AiCallResult = { ok: boolean; status: number; data: any };
export type AiCall = (path: string, method?: 'GET' | 'POST', body?: unknown) => Promise<AiCallResult>;

type Action = 'accept' | 'modify' | 'reject';

interface ReviewData {
  prediction_id: string;
  created_at: string;
  llm_model: string | null;
  images_analyzed: number;
  suggestion: {
    category: string; priority: string; summary: string; facts: string[]; assumptions: string[];
    recommendation: string; observed_in_images?: string[];
  };
  report: { id: string; reference: string; title: string; category: string; priority: string; status: string; updated_at: string | null };
  decision: null | {
    decision: 'accepted' | 'modified' | 'rejected'; decided_at: string; decided_by_name: string | null; decided_role: string;
    previous_category: string; previous_priority: string; final_category: string; final_priority: string;
    category_applied: boolean; priority_applied: boolean; comment: string | null;
  };
  decisions_enabled: boolean;
  allowed: { categories: string[]; priorities: string[]; can_lower_priority: boolean };
}

export const CATEGORY_LABELS: Record<string, string> = {
  traffic: 'Circulation', waste: 'Déchets', lighting: 'Éclairage public', water: 'Eau', power: 'Énergie',
  security: 'Sécurité', road: 'Voirie', other: 'Autre',
};
export const PRIORITY_LABELS: Record<string, string> = { low: 'Faible', medium: 'Moyenne', high: 'Élevée', critical: 'Critique' };
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', validated: 'Validé', assigned: 'Assigné', in_progress: 'En cours', resolved: 'Résolu', rejected: 'Rejeté',
};
const DECISION_LABELS = { accepted: 'Acceptée', modified: 'Modifiée', rejected: 'Rejetée' } as const;
const RANK = ['low', 'medium', 'high', 'critical'];

const catLabel = (v: string) => `${CATEGORY_LABELS[v] ?? v} (${v})`;
const priLabel = (v: string) => `${PRIORITY_LABELS[v] ?? v} (${v})`;
const isLowering = (from: string, to: string) => RANK.indexOf(to) < RANK.indexOf(from);
const fmt = (iso: string) => new Date(iso).toLocaleString('fr-FR');
/** Clé d'idempotence (uuid v4). randomUUID n'existe qu'en contexte sécurisé : repli sur getRandomValues. */
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

interface Pending {
  action: Action;
  applyCategory: boolean; applyPriority: boolean;
  category: string; priority: string;           // valeurs finales prévues
}

export function AiSuggestionReview({ predictionId, call, onDecided }: {
  predictionId: string; call: AiCall; onDecided?: () => void;
}) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [applyCategory, setApplyCategory] = useState(false);
  const [applyPriority, setApplyPriority] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editPriority, setEditPriority] = useState('');

  const [pending, setPending] = useState<Pending | null>(null);
  const [comment, setComment] = useState('');
  const [confirmDecrease, setConfirmDecrease] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const inFlight = useRef(false);          // garde synchrone contre les doubles clics
  const requestId = useRef<string>('');    // clé d'idempotence : conservée pour les nouvelles tentatives du même dialogue

  const load = useCallback(async () => {
    setLoading(true);
    const r = await call(`/suggestions/${predictionId}`, 'GET');
    if (!r.ok) {
      setData(null);
      setLoadError(r.data?.message ?? r.data?.error ?? `Erreur HTTP ${r.status}`);
    } else {
      const d = r.data as ReviewData;
      setData(d);
      setLoadError(null);
      // Par défaut : un champ n'est coché que s'il change réellement ; une BAISSE de priorité n'est jamais cochée d'office.
      setApplyCategory(d.suggestion.category !== d.report.category);
      setApplyPriority(d.suggestion.priority !== d.report.priority && !isLowering(d.report.priority, d.suggestion.priority));
      setEditCategory(d.suggestion.category);
      setEditPriority(d.suggestion.priority);
      setModifying(false);
    }
    setLoading(false);
  }, [call, predictionId]);

  useEffect(() => { setFeedback(null); setPending(null); load(); }, [load]);

  if (loading && !data) {
    return <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement de la suggestion…</p>;
  }
  if (!data) {
    return (
      <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {loadError ?? 'Suggestion introuvable.'}
      </p>
    );
  }

  const { report, suggestion, allowed, decision } = data;
  const canAct = data.decisions_enabled && !decision;
  const sameCat = suggestion.category === report.category;
  const samePri = suggestion.priority === report.priority;
  const suggestionLowersPriority = isLowering(report.priority, suggestion.priority);
  const priorityBlocked = suggestionLowersPriority && !allowed.can_lower_priority;

  const editLowers = isLowering(report.priority, editPriority);
  const editBlocked = editLowers && !allowed.can_lower_priority;
  const editUnchanged = editCategory === suggestion.category && editPriority === suggestion.priority;

  const openConfirm = (p: Pending) => {
    requestId.current = newRequestId();
    setComment('');
    setConfirmDecrease(false);
    setFeedback(null);
    setPending(p);
  };

  const finalValues = (p: Pending) => {
    if (p.action === 'reject') return { cat: report.category, pri: report.priority };
    if (p.action === 'accept') {
      return { cat: p.applyCategory ? suggestion.category : report.category, pri: p.applyPriority ? suggestion.priority : report.priority };
    }
    return { cat: p.category, pri: p.priority };
  };

  const submit = async () => {
    if (!pending || inFlight.current) return;
    const { pri } = finalValues(pending);
    const lowers = pending.action !== 'reject' && isLowering(report.priority, pri);
    if (lowers && !confirmDecrease) return;
    inFlight.current = true;
    setSubmitting(true);
    setFeedback(null);
    const body: Record<string, unknown> = {
      action: pending.action,
      request_id: requestId.current,
      expected: { category: report.category, priority: report.priority, updated_at: report.updated_at },
      confirm_priority_decrease: lowers && confirmDecrease,
      comment: comment.trim() || undefined,
    };
    if (pending.action === 'accept') { body.apply_category = pending.applyCategory; body.apply_priority = pending.applyPriority; }
    if (pending.action === 'modify') { body.category = pending.category; body.priority = pending.priority; }

    const r = await call(`/suggestions/${predictionId}/decision`, 'POST', body);
    inFlight.current = false;
    setSubmitting(false);

    if (r.ok) {
      setPending(null);
      setFeedback({
        kind: 'success',
        text: pending.action === 'reject' ? 'Suggestion rejetée : le signalement n’a pas été modifié.'
          : pending.action === 'accept' ? 'Suggestion acceptée : les champs approuvés ont été appliqués au signalement.'
          : 'Valeurs modifiées enregistrées et appliquées au signalement.',
      });
      await load();
      onDecided?.();
      return;
    }
    const code = r.data?.error;
    const text = r.status === 0
      ? 'Réseau indisponible : la décision n’a peut-être pas été enregistrée. Vous pouvez réessayer sans risque de doublon.'
      : (r.data?.message ?? r.data?.error ?? `Erreur HTTP ${r.status}`);
    if (code === 'report_changed' || code === 'already_decided') {
      setPending(null);
      setFeedback({ kind: 'error', text });
      await load();            // valeurs fraîches : l'agent revoit la situation avant de décider à nouveau
      return;
    }
    setFeedback({ kind: 'error', text });
  };

  const recap = pending ? finalValues(pending) : null;
  const recapLowers = pending && recap ? pending.action !== 'reject' && isLowering(report.priority, recap.pri) : false;
  const recapNothing = pending && recap && pending.action !== 'reject' && recap.cat === report.category && recap.pri === report.priority;

  return (
    <section aria-label="Validation humaine de la suggestion IA" className="mt-4 space-y-4">
      {feedback && !(pending && feedback.kind === 'error') && (
        <p role={feedback.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-md border p-3 text-sm ${feedback.kind === 'error'
            ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-success/40 bg-success/10'}`}>
          {feedback.kind === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{feedback.text}</span>
        </p>
      )}

      {!data.decisions_enabled && (
        <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          La validation humaine n’est pas encore activée sur cette base (migration 026 non appliquée). La suggestion reste consultable ; aucune action n’est possible.
        </p>
      )}

      {decision && (
        <div role="status" className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={decision.decision === 'rejected' ? 'destructive' : 'default'}>Décision : {DECISION_LABELS[decision.decision]}</Badge>
            <span className="text-xs text-muted-foreground">
              par {decision.decided_by_name ?? 'un agent'} ({decision.decided_role}) le {fmt(decision.decided_at)}
            </span>
          </div>
          <p>
            Avant : {catLabel(decision.previous_category)} / {priLabel(decision.previous_priority)} → Après : {catLabel(decision.final_category)} / {priLabel(decision.final_priority)}
            {decision.decision === 'rejected' && ' (aucune modification appliquée)'}
          </p>
          {decision.comment && <p className="text-muted-foreground">Commentaire : {decision.comment}</p>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 text-sm" aria-labelledby={`cur-${predictionId}`}>
          <h3 id={`cur-${predictionId}`} className="mb-2 font-semibold">Valeurs actuellement enregistrées</h3>
          <p className="mb-2 text-xs text-muted-foreground">{report.reference} · {report.title.slice(0, 80)}</p>
          <dl className="space-y-1">
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Catégorie</dt><dd>{catLabel(report.category)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Priorité</dt><dd>{priLabel(report.priority)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Statut</dt><dd>{STATUS_LABELS[report.status] ?? report.status}</dd></div>
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm" aria-labelledby={`sug-${predictionId}`}>
          <h3 id={`sug-${predictionId}`} className="mb-2 font-semibold">Suggestion de Gemini</h3>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge>Catégorie proposée : {catLabel(suggestion.category)}</Badge>
            <Badge variant="secondary">Priorité proposée : {priLabel(suggestion.priority)}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Modèle : {data.llm_model ?? 'inconnu'} · générée le {fmt(data.created_at)}
            {data.images_analyzed > 0 ? ` · ${data.images_analyzed} image(s) analysée(s)` : ' · texte seul'}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p><strong>Résumé :</strong> {suggestion.summary}</p>
        <div><strong>Faits (tirés du signalement) :</strong><ul className="ml-5 list-disc">{suggestion.facts.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
        <div><strong>Hypothèses :</strong><ul className="ml-5 list-disc">{suggestion.assumptions.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
        {suggestion.observed_in_images && suggestion.observed_in_images.length > 0 && (
          <div><strong>Visible sur les images :</strong><ul className="ml-5 list-disc">{suggestion.observed_in_images.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
        )}
        <p><strong>Recommandation :</strong> {suggestion.recommendation}</p>
        <p className="text-xs text-warning">Suggestion générée par un modèle : à valider par un agent avant toute décision.</p>
      </div>

      {canAct && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h3 className="font-semibold">Votre décision</h3>

          {suggestionLowersPriority && (
            <p role="note" className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Cette suggestion <strong>baisse la priorité</strong> ({PRIORITY_LABELS[report.priority] ?? report.priority} → {PRIORITY_LABELS[suggestion.priority] ?? suggestion.priority}).
                {report.priority === 'critical' && ' Une priorité critique n’est jamais abaissée automatiquement.'}{' '}
                {allowed.can_lower_priority
                  ? 'Cochez « Appliquer la priorité » puis confirmez explicitement la baisse.'
                  : 'Votre rôle ne permet pas de baisser une priorité : seule la catégorie peut être appliquée.'}
              </span>
            </p>
          )}

          {!modifying ? (
            <>
              <fieldset className="space-y-3">
                <legend className="mb-1 text-sm font-medium">Champs à appliquer (acceptation)</legend>
                <div className="flex items-center gap-2">
                  <Checkbox id={`apc-${predictionId}`} checked={applyCategory} disabled={submitting || sameCat}
                    onCheckedChange={(v) => setApplyCategory(v === true)} />
                  <Label htmlFor={`apc-${predictionId}`}>
                    Appliquer la catégorie : {catLabel(report.category)} → {catLabel(suggestion.category)}{sameCat && ' (identique, rien à changer)'}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id={`app-${predictionId}`} checked={applyPriority} disabled={submitting || samePri || priorityBlocked}
                    onCheckedChange={(v) => setApplyPriority(v === true)} />
                  <Label htmlFor={`app-${predictionId}`}>
                    Appliquer la priorité : {priLabel(report.priority)} → {priLabel(suggestion.priority)}{samePri && ' (identique, rien à changer)'}
                  </Label>
                </div>
              </fieldset>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button disabled={submitting || !(applyCategory || applyPriority)}
                  onClick={() => openConfirm({ action: 'accept', applyCategory, applyPriority, category: suggestion.category, priority: suggestion.priority })}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Accepter
                </Button>
                <Button variant="outline" disabled={submitting} onClick={() => setModifying(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Modifier
                </Button>
                <Button variant="outline" disabled={submitting}
                  onClick={() => openConfirm({ action: 'reject', applyCategory: false, applyPriority: false, category: report.category, priority: report.priority })}>
                  <XCircle className="mr-2 h-4 w-4" /> Rejeter
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`ec-${predictionId}`}>Catégorie retenue</Label>
                  <select id={`ec-${predictionId}`} value={editCategory} onChange={(e) => setEditCategory(e.target.value)} disabled={submitting}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {allowed.categories.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`ep-${predictionId}`}>Priorité retenue</Label>
                  <select id={`ep-${predictionId}`} value={editPriority} onChange={(e) => setEditPriority(e.target.value)} disabled={submitting}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {allowed.priorities.map((p) => <option key={p} value={p}>{priLabel(p)}</option>)}
                  </select>
                </div>
              </div>
              {editBlocked && <p role="alert" className="text-sm text-destructive">Votre rôle ne permet pas de baisser la priorité en dessous de la valeur actuelle.</p>}
              {editUnchanged && <p role="note" className="text-sm text-muted-foreground">Valeurs identiques à la suggestion : utilisez « Accepter ».</p>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button disabled={submitting || editBlocked || editUnchanged}
                  onClick={() => openConfirm({ action: 'modify', applyCategory: true, applyPriority: true, category: editCategory, priority: editPriority })}>
                  Voir le récapitulatif
                </Button>
                <Button variant="outline" disabled={submitting} onClick={() => setModifying(false)}>Annuler la modification</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(o) => { if (!o && !submitting) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.action === 'reject' ? 'Rejeter la suggestion ?' : pending?.action === 'modify' ? 'Appliquer vos valeurs ?' : 'Accepter la suggestion ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === 'reject'
                ? 'Ni la catégorie ni la priorité du signalement ne seront modifiées. Le rejet sera enregistré avec votre nom et la date ; la suggestion de Gemini reste consultable.'
                : `Vérifiez les valeurs qui seront appliquées au signalement ${report.reference}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            {recap && (
              <ul className="space-y-1 rounded-md border border-border bg-muted/40 p-3">
                <li>Catégorie : {catLabel(report.category)}{recap.cat !== report.category ? <> → <strong>{catLabel(recap.cat)}</strong></> : ' (inchangée)'}</li>
                <li>Priorité : {priLabel(report.priority)}{recap.pri !== report.priority ? <> → <strong>{priLabel(recap.pri)}</strong></> : ' (inchangée)'}</li>
                <li>Statut : {STATUS_LABELS[report.status] ?? report.status} (inchangé)</li>
              </ul>
            )}
            {recapNothing && <p>Ces valeurs sont identiques aux valeurs actuelles : seule la décision sera enregistrée.</p>}
            {recapLowers && (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
                <Checkbox id={`cd-${predictionId}`} checked={confirmDecrease} disabled={submitting}
                  onCheckedChange={(v) => setConfirmDecrease(v === true)} />
                <Label htmlFor={`cd-${predictionId}`}>
                  Je confirme explicitement la baisse de priorité de « {PRIORITY_LABELS[report.priority] ?? report.priority} » à « {PRIORITY_LABELS[recap!.pri] ?? recap!.pri} ».
                </Label>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor={`cm-${predictionId}`}>Commentaire (facultatif)</Label>
              <Textarea id={`cm-${predictionId}`} value={comment} maxLength={500} disabled={submitting}
                onChange={(e) => setComment(e.target.value)} rows={2} />
            </div>
            {feedback?.kind === 'error' && <p role="alert" className="text-destructive">{feedback.text}</p>}
          </div>
          <AlertDialogFooter>
            <Button variant="outline" disabled={submitting} onClick={() => setPending(null)}>Annuler</Button>
            <Button disabled={submitting || (recapLowers && !confirmDecrease)} onClick={submit}
              variant={pending?.action === 'reject' ? 'destructive' : 'default'}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</>
                : pending?.action === 'reject' ? 'Confirmer le rejet' : 'Confirmer'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
