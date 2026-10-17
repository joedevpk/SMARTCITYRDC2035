'use client';

import { useCallback, useEffect, useState } from 'react';
import { Brain, TrendingUp, AlertTriangle, Zap, Shield, Sparkles, RefreshCw, FileSearch, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { EmptyState, SimulationBadge } from '@/components/dashboard/data-provenance';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/auth/role-guard';
import { AiSuggestionReview } from '@/components/dashboard/ai-suggestion-review';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type CallResult = { ok: boolean; status: number; data: any };

/** Calls the ai-service Edge Function with the signed-in user's JWT (never the anon key). */
async function callAI(path: string, method: 'GET' | 'POST' = 'POST', body?: unknown): Promise<CallResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, status: 401, data: { error: 'Session expirée, reconnectez-vous.' } };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(`${baseUrl}/functions/v1/ai-service${path}`, {
      method,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: anonKey, 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({ error: `Réponse illisible (HTTP ${res.status})` }));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Service IA injoignable (fonction non déployée, CORS ou réseau).' } };
  }
}

interface ReportRow { id: string; reference: string; title: string; category: string; priority: string; is_demo: boolean }

const stats = [
  { key: 'traffic', label: 'Prévision trafic', path: '/predict/traffic', icon: TrendingUp },
  { key: 'energy', label: 'Prévision énergie', path: '/predict/energy', icon: Zap },
  { key: 'anomaly', label: 'Anomalies capteurs', path: '/detect/anomalies', icon: AlertTriangle },
  { key: 'incident', label: 'Synthèse incidents', path: '/analyze/incidents', icon: Shield },
] as const;

export default function AIDashboard() {
  const [status, setStatus] = useState<{ llm_configured: boolean; model: string | null; error?: string } | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState<CallResult | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, CallResult>>({});
  const [history, setHistory] = useState<any[]>([]);
  // Validation humaine : suggestion actuellement ouverte + décisions déjà enregistrées (prediction_id → décision)
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});

  const loadHistory = useCallback(async () => {
    const r = await callAI('/predictions', 'GET');
    if (r.ok) setHistory(r.data.data ?? []);
    const d = await callAI('/decisions', 'GET');
    if (d.ok && Array.isArray(d.data.data)) {
      setDecisions(Object.fromEntries(d.data.data.map((x: { prediction_id: string; decision: string }) => [x.prediction_id, x.decision])));
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) { setStatus({ llm_configured: false, model: null, error: 'Backend non configuré.' }); return; }
    (async () => {
      const s = await callAI('/status', 'GET');
      setStatus(s.ok ? s.data : { llm_configured: false, model: null, error: s.data?.error ?? `HTTP ${s.status}` });
      const { data } = await supabase.from('reports')
        .select('id, reference, title, category, priority, is_demo')
        .order('created_at', { ascending: false }).limit(25);
      setReports((data ?? []) as ReportRow[]);
      loadHistory();
    })();
  }, [loadHistory]);

  const classify = async () => {
    if (!selectedId) return;
    setClassifying(true);
    setClassification(null);
    setReviewId(null);
    const res = await callAI('/classify-report', 'POST', { report_id: selectedId });
    setClassification(res);
    if (res.ok && typeof res.data?.prediction_id === 'string') setReviewId(res.data.prediction_id);
    setClassifying(false);
    loadHistory();
  };

  const runStat = async (key: string, path: string) => {
    setRunning(key);
    const r = await callAI(path, 'POST', { hours: 6 });
    setResults((prev) => ({ ...prev, [key]: r }));
    setRunning(null);
  };

  const suggestion = classification?.ok ? classification.data.suggestion : null;

  return (
    <RoleGuard dashboard="SHARED">
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader
          title="IA & analyses"
          description="Un cas d’usage IA réel (classification de signalements) et des analyses statistiques sur données authentifiées"
          icon={Brain}
        />

        <div role="status" className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${status?.llm_configured ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10'}`}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {status === null ? 'Vérification du service IA…'
              : status.error ? <>Service IA indisponible : {status.error}</>
              : status.llm_configured ? <>Modèle IA configuré côté serveur : <strong>{status.model}</strong>. La clé API n’est jamais exposée au navigateur.</>
              : <><strong>IA non configurée.</strong> Définissez GEMINI_API_KEY et AI_MODEL (Google Gemini) dans les secrets de la fonction <code>ai-service</code>. Le reste de la plateforme fonctionne sans.</>}
          </div>
        </div>

        <Card>
          <SectionTitle title="Classer un signalement avec l’IA" action={<FileSearch className="h-4 w-4 text-primary" />} />
          <p className="mb-3 text-sm text-muted-foreground">
            Le modèle reçoit uniquement le titre, la description et l’adresse du signalement. Il propose une catégorie, une priorité et un résumé ;
            <strong> un agent doit valider</strong>. Il ne peut ni inventer de lieu, ni de mesure, ni d’intervention.
          </p>
          {reports.length === 0 ? (
            <EmptyState title="Aucun signalement" reason="Créez un signalement pour pouvoir tester la classification." />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <select aria-label="Signalement à analyser" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— choisir un signalement —</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>{r.reference} · {r.title.slice(0, 60)}{r.is_demo ? ' [DÉMO]' : ''}</option>
                ))}
              </select>
              <Button onClick={classify} disabled={!selectedId || classifying || !status?.llm_configured}>
                {classifying ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Analyse…</> : <><Sparkles className="mr-2 h-4 w-4" /> Analyser</>}
              </Button>
            </div>
          )}
          {classification && !classification.ok && (
            <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {classification.data?.message ?? classification.data?.error ?? `Erreur HTTP ${classification.status}`}
            </p>
          )}
          {reviewId && <AiSuggestionReview key={reviewId} predictionId={reviewId} call={callAI} onDecided={loadHistory} />}
          {suggestion && !reviewId && (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Catégorie proposée : {suggestion.category}</Badge>
                <Badge variant="secondary">Priorité proposée : {suggestion.priority}</Badge>
                <span className="text-xs text-muted-foreground">
                  (actuel : {classification!.data.current.category} / {classification!.data.current.priority}) · {classification!.data.llm_model}
                </span>
              </div>
              <p><strong>Résumé :</strong> {suggestion.summary}</p>
              <div><strong>Faits (tirés du signalement) :</strong><ul className="ml-5 list-disc">{suggestion.facts.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul></div>
              <div><strong>Hypothèses :</strong><ul className="ml-5 list-disc">{suggestion.assumptions.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul></div>
              <p><strong>Recommandation :</strong> {suggestion.recommendation}</p>
              <p className="text-xs text-warning">Suggestion générée par un modèle : à valider par un agent avant toute décision.</p>
              <p role="alert" className="text-xs text-destructive">Cette suggestion n’a pas pu être enregistrée : la validation (accepter / modifier / rejeter) est impossible. Relancez l’analyse.</p>
            </div>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {stats.map((s) => {
            const r = results[s.key];
            const chart = r?.ok && r.data.forecast
              ? r.data.forecast.map((f: any) => ({ hour: `H+${f.hour}`, value: f.predicted_vehicles ?? f.predicted_kw }))
              : null;
            return (
              <Card key={s.key}>
                <SectionTitle title={s.label} action={<s.icon className="h-4 w-4 text-primary" />} />
                <p className="mb-3 text-xs text-muted-foreground">Calcul statistique (moyenne mobile, tendance linéaire, z-score) — pas un modèle d’IA. Données réelles authentifiées uniquement.</p>
                <Button size="sm" variant="outline" disabled={running === s.key} onClick={() => runStat(s.key, s.path)}>
                  {running === s.key ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Calcul…</> : 'Lancer le calcul'}
                </Button>
                {r && !r.ok && (
                  <p role="alert" className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                    {r.data?.message ?? r.data?.error ?? `Erreur HTTP ${r.status}`}
                  </p>
                )}
                {chart && (
                  <div className="mt-3">
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hour" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-muted-foreground">
                      Basé sur {r!.data.based_on_points} mesures · ajustement R² = {r!.data.fit_r2} (qualité d’ajustement, pas une probabilité). {r!.data.caveat}
                    </p>
                  </div>
                )}
                {r?.ok && !chart && (
                  <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-muted/40 p-3 text-xs">{JSON.stringify(r.data, null, 2)}</pre>
                )}
              </Card>
            );
          })}
        </div>

        <Card>
          <SectionTitle title="Historique des analyses enregistrées" />
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune analyse enregistrée.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <span>{h.model}</span>
                  <span className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                    {h.model === 'report_classification' && (
                      <>
                        <Badge variant={decisions[h.id] ? 'default' : 'outline'}>
                          {decisions[h.id] === 'accepted' ? 'Acceptée' : decisions[h.id] === 'modified' ? 'Modifiée' : decisions[h.id] === 'rejected' ? 'Rejetée' : 'À valider'}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => { setReviewId(h.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                          Consulter
                        </Button>
                      </>
                    )}
                    {h.features?.is_llm ? <Badge variant="secondary">LLM</Badge> : <Badge variant="outline">statistique</Badge>}
                    {new Date(h.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </RoleGuard>
  );
}
