'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { FileText, Search, Filter, CheckCircle2, Clock, AlertCircle, MapPin } from 'lucide-react';
import { DashboardPageHeader, Card } from '@/components/dashboard/dashboard-primitives';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/stores/auth-store';
import { RoleGuard } from '@/components/auth/role-guard';
import { signedUrls } from '@/lib/report-attachments';
import { SimulationBadge, EmptyState } from '@/components/dashboard/data-provenance';

const statusColor: Record<string, string> = {
  resolved: 'bg-success/15 text-success border-success/30',
  in_progress: 'bg-warning/15 text-warning border-warning/30',
  pending: 'bg-muted text-muted-foreground border-border',
  validated: 'bg-primary/15 text-primary border-primary/30',
  assigned: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
};

const statusLabel: Record<string, string> = {
  resolved: 'Résolu',
  in_progress: 'En cours',
  pending: 'En attente',
  validated: 'Validé',
  assigned: 'Assigné',
  rejected: 'Rejeté',
};

const statusIcon: Record<string, typeof CheckCircle2> = {
  resolved: CheckCircle2,
  in_progress: Clock,
  pending: AlertCircle,
  validated: CheckCircle2,
  assigned: Clock,
  rejected: AlertCircle,
};

const categories = ['Toutes', 'lighting', 'water', 'waste', 'road', 'power', 'security', 'traffic', 'other'];
const statuses = ['Tous', 'pending', 'validated', 'assigned', 'in_progress', 'resolved', 'rejected'];

const categoryLabel: Record<string, string> = {
  lighting: 'Éclairage',
  water: 'Eau',
  waste: 'Déchets',
  road: 'Voirie',
  power: 'Électricité',
  security: 'Sécurité',
  traffic: 'Trafic',
  other: 'Autre',
};

interface Report {
  id: string;
  reference: string;
  category: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  address: string;
  created_at: string;
  is_demo?: boolean;
  reporter?: { full_name: string };
  commune?: { name: string };
  attachments?: { storage_path: string }[];
}

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const { user } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('Toutes');
  const [status, setStatus] = useState('Tous');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      let q = supabase
        .from('reports')
        .select(`
          id, reference, category, title, description, status, priority, address, created_at, is_demo,
          reporter:profiles!reporter_id(full_name),
          commune:communes(name),
          attachments:report_attachments(storage_path)
        `)
        .eq('attachments.verified', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (category !== 'Toutes') q = q.eq('category', category);
      if (status !== 'Tous') q = q.eq('status', status);
      if (query) q = q.ilike('title', `%${query}%`);
      if (user?.role === 'citizen') q = q.eq('reporter_id', user.id);

      const { data, error } = await q;
      if (error) {
        setLoadError(error.message);
        setReports([]);
      } else {
        setLoadError(null);
        const rows = (data ?? []) as unknown as Report[];
        setReports(rows);
        // Bucket privé : URL signées de 10 min ; si la signature échoue, la liste reste utilisable sans miniatures.
        setPhotoUrls(await signedUrls(supabase, rows.flatMap((r) => (r.attachments ?? []).map((a) => a.storage_path))));
      }
      setLoading(false);
    }
    loadReports();
  }, [category, status, query, user?.id, user?.role]);

  return (
    <RoleGuard dashboard="SHARED">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title="Signalements"
        description={user?.role === 'citizen' ? 'Vos signalements et leur état de traitement' : 'Signalements enregistrés dans la plateforme'}
        icon={FileText}
      />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher par titre..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-44"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c} value={c}>{c === 'Toutes' ? 'Toutes' : categoryLabel[c] || c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s === 'Tous' ? 'Tous' : statusLabel[s] || s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{loading ? 'Chargement...' : `${reports.length} signalement(s) trouvé(s)`}</p>
        </div>
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          ) : loadError ? (
            <p role="alert" className="py-8 text-center text-sm text-destructive">Impossible de charger les signalements : {loadError}</p>
          ) : reports.length === 0 ? (
            <EmptyState title="Aucun signalement" reason="Aucun signalement enregistré ne correspond à ces critères. Les signalements créés depuis « Signaler » apparaîtront ici." />
          ) : (
            reports.map((r, i) => {
              const Icon = statusIcon[r.status] || AlertCircle;
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                        <Badge variant="outline" className="text-[10px]">{categoryLabel[r.category] || r.category}</Badge>
                        {r.is_demo && <SimulationBadge label="DÉMO" />}
                      </div>
                      <p className="mt-1 text-sm font-medium">{r.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {r.address || r.commune?.name || 'N/A'} · {new Date(r.created_at).toLocaleDateString('fr-FR')}
                      </p>
                      {(r.attachments ?? []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(r.attachments ?? []).map((a, k) => photoUrls[a.storage_path] ? (
                            <a key={a.storage_path} href={photoUrls[a.storage_path]} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir la photo ${k + 1} du signalement ${r.reference}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={photoUrls[a.storage_path]} alt={`Photo ${k + 1} du signalement ${r.reference}`} className="h-14 w-14 rounded-md border border-border object-cover" loading="lazy" />
                            </a>
                          ) : (
                            <span key={a.storage_path} className="text-xs text-muted-foreground">Photo indisponible</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`inline-block w-fit rounded-full border px-3 py-1 text-xs font-medium ${statusColor[r.status] || statusColor.pending}`}>
                    {statusLabel[r.status] || r.status}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>
      </Card>
    </div>
    </RoleGuard>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ReportsPageContent />
    </Suspense>
  );
}
