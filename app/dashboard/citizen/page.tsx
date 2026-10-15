'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, FileText, Map, Bell, Plus, CheckCircle2, Clock, AlertCircle,
  Camera, CloudRain, Sun, Cloud, Thermometer, Newspaper, ChevronRight,
  Zap, Droplets, Trash2, Lightbulb, ShieldAlert, TrafficCone, Calendar,
  TrendingUp, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/stores/auth-store';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { RoleGuard } from '@/components/auth/role-guard';

const statusColor: Record<string, string> = {
  resolved: 'bg-success/15 text-success border-success/30',
  in_progress: 'bg-warning/15 text-warning border-warning/30',
  pending: 'bg-muted text-muted-foreground border-border',
  validated: 'bg-primary/15 text-primary border-primary/30',
  assigned: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
};

const statusLabel: Record<string, string> = {
  resolved: 'Résolu', in_progress: 'En cours', pending: 'En attente', validated: 'Validé', assigned: 'Assigné',
};

const priorityColor: Record<string, string> = {
  critical: 'bg-destructive/15 text-destructive',
  high: 'bg-destructive/15 text-destructive',
  medium: 'bg-warning/15 text-warning',
  low: 'bg-muted text-muted-foreground',
};

const quickActions = [
  { icon: Camera, label: 'Signaler', href: '/dashboard/reports/new', color: 'bg-red-500/10 text-red-500' },
  { icon: FileText, label: 'Mes dossiers', href: '/dashboard/reports', color: 'bg-blue-500/10 text-blue-500' },
  { icon: Map, label: 'Carte', href: '/dashboard/map', color: 'bg-green-500/10 text-green-500' },
  { icon: Bell, label: 'Alertes', href: '/dashboard/notifications', color: 'bg-amber-500/10 text-amber-500' },
];

const serviceIcons: Record<string, typeof Zap> = {
  lighting: Lightbulb, water: Droplets, waste: Trash2, road: TrafficCone,
  power: Zap, security: ShieldAlert, traffic: TrafficCone, other: AlertCircle,
};

interface MyReport {
  id: string;
  reference: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  address: string;
  created_at: string;
  commune?: { name: string };
}

interface NewsItem {
  id: string;
  title: string;
  category: string;
  created_at: string;
}

const severityStyle: Record<string, string> = {
  warning: 'bg-warning/10 text-warning border-warning/30',
  info: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
};

interface AlertItem { id: string; title: string; message: string; type: string; created_at: string }
const alertSeverity: Record<string, string> = { warning: 'warning', error: 'critical', info: 'info', success: 'info' };

export default function CitizenDashboard() {
  const { user } = useAuth();
  return (
    <RoleGuard dashboard="citizen">
    <CitizenDashboardInner user={user} />
    </RoleGuard>
  );
}

function CitizenDashboardInner({ user }: { user: any }) {
  const [myReports, setMyReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activity, setActivity] = useState<{ name: string; value: number }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      const [reportsRes, newsRes, notifRes, allRes] = await Promise.all([
        supabase
          .from('reports')
          .select('id, reference, title, category, status, priority, address, created_at, commune:communes(name)')
          .eq('reporter_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('news_articles')
          .select('id, title, category, created_at')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('notifications')
          .select('id, title, message, type, created_at')
          .eq('user_id', user.id)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('reports')
          .select('created_at')
          .eq('reporter_id', user.id)
          .gte('created_at', new Date(Date.now() - 183 * 86400000).toISOString())
          .limit(500),
      ]);
      const firstError = reportsRes.error || newsRes.error || notifRes.error || allRes.error;
      setLoadError(firstError ? firstError.message : null);
      if (reportsRes.data) setMyReports(reportsRes.data as unknown as MyReport[]);
      if (newsRes.data) setNews(newsRes.data as unknown as NewsItem[]);
      if (notifRes.data) setAlerts(notifRes.data as unknown as AlertItem[]);
      // Real monthly counts of the user's own reports over the last 6 months (0 when none).
      const buckets: { key: string; name: string; value: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
        buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, name: d.toLocaleDateString('fr-FR', { month: 'short' }), value: 0 });
      }
      for (const r of (allRes.data ?? []) as { created_at: string }[]) {
        const d = new Date(r.created_at);
        const b = buckets.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
        if (b) b.value++;
      }
      setActivity(buckets.map(({ name, value }) => ({ name, value })));
      setLoading(false);
    }
    loadData();
  }, [user?.id]);

  const resolved = myReports.filter((r) => r.status === 'resolved').length;
  const inProgress = myReports.filter((r) => r.status !== 'resolved').length;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title={`Bonjour, ${user?.name?.split(' ')[0] ?? 'Citoyen'}`}
        description="Votre espace citoyen — signalez et suivez vos demandes"
        icon={User}
        actions={
          <Button asChild>
            <Link href="/dashboard/reports/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau signalement
            </Link>
          </Button>
        }
      />

      {loadError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Certaines données n&apos;ont pas pu être chargées : {loadError}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((a, i) => (
          <motion.div key={a.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={a.href}>
              <div className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                <span className={cn('flex h-12 w-12 items-center justify-center rounded-xl', a.color)}>
                  <a.icon className="h-6 w-6" />
                </span>
                <span className="text-sm font-medium">{a.label}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: FileText, label: 'Mes signalements', value: loading ? '—' : String(myReports.length), color: 'text-primary' },
          { icon: CheckCircle2, label: 'Résolus', value: loading ? '—' : String(resolved), color: 'text-success' },
          { icon: Clock, label: 'En cours', value: loading ? '—' : String(inProgress), color: 'text-warning' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
            <s.icon className={cn('h-10 w-10', s.color)} />
            <div>
              <p className="font-display text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent reports */}
        <Card className="lg:col-span-2">
          <SectionTitle title="Mes signalements récents" action={
            <Link href="/dashboard/reports" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Voir tout <ChevronRight className="h-3 w-3" />
            </Link>
          } />
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/50" />)}</div>
            ) : myReports.length === 0 ? (
              <div className="py-8 text-center">
                <Camera className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Aucun signalement. Créez-en un !</p>
                <Button asChild className="mt-4" size="sm">
                  <Link href="/dashboard/reports/new"><Plus className="mr-2 h-4 w-4" /> Créer un signalement</Link>
                </Button>
              </div>
            ) : (
              myReports.map((r, i) => {
                const Icon = serviceIcons[r.category] || AlertCircle;
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                          <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', priorityColor[r.priority] || priorityColor.low)}>{r.priority}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">{r.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.address || r.commune?.name || 'N/A'} · {new Date(r.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                    <span className={cn('ml-3 inline-block shrink-0 rounded-full border px-2.5 py-1 text-xs', statusColor[r.status] || statusColor.pending)}>{statusLabel[r.status] || r.status}</span>
                  </motion.div>
                );
              })
            )}
          </div>
        </Card>

        {/* Right column: weather + alerts */}
        <div className="space-y-4">
          <Card>
            <SectionTitle title="Notifications non lues" action={
              <Link href="/dashboard/notifications" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Voir tout <ChevronRight className="h-3 w-3" />
              </Link>
            } />
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Aucune notification non lue.</p>
              ) : alerts.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cn('flex items-start gap-3 rounded-lg border p-3', severityStyle[alertSeverity[a.type] ?? 'info'])}>
                  <Bell className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.message}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Aucune source météo ni alerte publique n’est raccordée à la plateforme pour le moment.</p>
          </Card>
        </div>
      </div>

      {/* Activity chart + News */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Mes signalements par mois (6 derniers mois)" action={<TrendingUp className="h-4 w-4 text-primary" />} />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activity}>
              <defs>
                <linearGradient id="citGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#citGrad)" strokeWidth={2} name="Signalements" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle title="Dernières actualités" action={
            <Link href="/dashboard/news" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Voir tout <ChevronRight className="h-3 w-3" />
            </Link>
          } />
          <div className="space-y-3">
            {news.length > 0 ? (
              news.map((n, i) => (
                <motion.div key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Newspaper className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <Badge variant="outline" className="mb-1 text-[10px]">{n.category}</Badge>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">{loading ? 'Chargement…' : 'Aucune actualité publiée.'}</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
