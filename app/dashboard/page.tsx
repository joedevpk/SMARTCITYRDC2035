'use client';

import { motion } from 'framer-motion';
import {
  Users, MapPin, FileText, Activity, Building2, AlertTriangle,
  CheckCircle2, Clock, TrendingUp,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { useAuth } from '@/lib/stores/auth-store';
import { useI18n } from '@/lib/stores/i18n-store';
import { supabase } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { RoleGuard } from '@/components/auth/role-guard';

const trafficData = [
  { name: 'Lun', routes: 1200, incidents: 24 },
  { name: 'Mar', routes: 1400, incidents: 18 },
  { name: 'Mer', routes: 1350, incidents: 30 },
  { name: 'Jeu', routes: 1600, incidents: 22 },
  { name: 'Ven', routes: 1800, incidents: 35 },
  { name: 'Sam', routes: 2100, incidents: 28 },
  { name: 'Dim', routes: 1500, incidents: 15 },
];

const serviceData = [
  { name: 'Trafic', value: 3200, color: 'hsl(211 100% 50%)' },
  { name: 'Déchets', value: 2800, color: 'hsl(142 71% 45%)' },
  { name: 'Éclairage', value: 1900, color: 'hsl(45 93% 52%)' },
  { name: 'Santé', value: 1500, color: 'hsl(0 63% 55%)' },
  { name: 'Sécurité', value: 1200, color: 'hsl(262 60% 65%)' },
];

const provinceData = [
  { name: 'Kinshasa', value: 4500 },
  { name: 'Lubumbashi', value: 3200 },
  { name: 'Goma', value: 2100 },
  { name: 'Mbuji-Mayi', value: 1800 },
  { name: 'Kisangani', value: 1500 },
  { name: 'Bukavu', value: 1200 },
];

const recentReports = [
  { id: 'RPT-001', type: 'Lampadaire', location: 'Gombe, Kinshasa', status: 'En cours', time: 'il y a 12 min' },
  { id: 'RPT-002', type: 'Déchet', location: 'Lemba, Kinshasa', status: 'Résolu', time: 'il y a 1h' },
  { id: 'RPT-003', type: 'Trafic', location: 'Ngaliema, Kinshasa', status: 'En attente', time: 'il y a 2h' },
  { id: 'RPT-004', type: 'Eau', location: 'Matete, Kinshasa', status: 'En cours', time: 'il y a 3h' },
  { id: 'RPT-005', type: 'Électricité', location: 'Bandal, Kinshasa', status: 'Résolu', time: 'il y a 5h' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0, inProgress: 0, resolutionRate: 0 });
  const [recentReports, setRecentReports] = useState<any[]>([]);

  useEffect(() => {
    async function loadStats() {
      const { data } = await supabase.from('reports').select('status');
      if (data) {
        const total = data.length;
        const resolved = data.filter((r) => r.status === 'resolved').length;
        const pending = data.filter((r) => r.status === 'pending').length;
        const inProgress = data.filter((r) => r.status === 'in_progress').length;
        setStats({
          total,
          resolved,
          pending,
          inProgress,
          resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
        });
      }

      const { data: recent } = await supabase
        .from('reports')
        .select('id, reference, category, title, status, address, created_at, commune:communes(name)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (recent) setRecentReports(recent);
    }
    loadStats();
  }, []);

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
  const categoryLabel: Record<string, string> = {
    lighting: 'Éclairage', water: 'Eau', waste: 'Déchets', road: 'Voirie', power: 'Électricité', security: 'Sécurité', traffic: 'Trafic', other: 'Autre',
  };

  return (
    <RoleGuard dashboard="SHARED">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title={`Bienvenue, ${user?.name?.split(' ')[0] ?? ''}`}
        description="Vue d'ensemble de la plateforme nationale"
        icon={Building2}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Citoyens connectés" value="95.4M" change="+2.4%" trend="up" icon={Users} delay={0} />
        <KpiCard title="Provinces actives" value="26" change="+0%" icon={MapPin} color="text-chart-2" delay={0.05} />
        <KpiCard title="Signalements (total)" value={String(stats.total)} change="+18%" trend="up" icon={FileText} color="text-chart-3" delay={0.1} />
        <KpiCard title="Taux résolution" value={`${stats.resolutionRate}%`} change="+5%" trend="up" icon={CheckCircle2} color="text-success" delay={0.15} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Activité hebdomadaire" action={<Badge variant="secondary">7 jours</Badge>} />
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Area type="monotone" dataKey="routes" stroke="hsl(var(--primary))" fill="url(#grad1)" strokeWidth={2} name="Routes" />
              <Area type="monotone" dataKey="incidents" stroke="hsl(var(--chart-4))" fill="url(#grad2)" strokeWidth={2} name="Incidents" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle title="Services publics" />
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={serviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                {serviceData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Signalements récents" action={<Badge variant="secondary">{recentReports.length}</Badge>} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Référence</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Localisation</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentReports.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Aucun signalement</td></tr>
                ) : (
                  recentReports.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-mono text-xs">{r.reference}</td>
                      <td className="py-2.5">{categoryLabel[r.category] || r.category}</td>
                      <td className="py-2.5 text-muted-foreground">{r.address || r.commune?.name || 'N/A'}</td>
                      <td className="py-2.5">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${statusColor[r.status] || statusColor.pending}`}>
                          {statusLabel[r.status] || r.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Top provinces" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={provinceData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: AlertTriangle, label: 'Alertes actives', value: '14', color: 'text-warning' },
          { icon: Clock, label: 'En attente', value: '32', color: 'text-muted-foreground' },
          { icon: Activity, label: 'En cours', value: '58', color: 'text-primary' },
          { icon: CheckCircle2, label: 'Résolus (jour)', value: '127', color: 'text-success' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <s.icon className={`h-8 w-8 ${s.color}`} />
            <div>
              <p className="font-display text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
    </RoleGuard>
  );
}
