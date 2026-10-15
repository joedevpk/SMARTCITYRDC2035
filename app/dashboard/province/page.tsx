'use client';

import { motion } from 'framer-motion';
import {
  Users, MapPin, FileText, CheckCircle2, Building2, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const kpiData = [
  { title: 'Population province', value: '17.3M', change: '+1.2%', trend: 'up' as const, icon: Users, color: 'text-primary' },
  { title: 'Communes actives', value: '24', change: '+2', trend: 'up' as const, icon: MapPin, color: 'text-chart-2' },
  { title: 'Signalements (mois)', value: '3.4K', change: '+12%', trend: 'up' as const, icon: FileText, color: 'text-chart-3' },
  { title: 'Taux résolution', value: '82%', change: '+6%', trend: 'up' as const, icon: CheckCircle2, color: 'text-success' },
];

const communeData = [
  { name: 'Gombe', signalements: 420, resolu: 380 },
  { name: 'Lemba', signalements: 310, resolu: 260 },
  { name: 'Ngaliema', signalements: 280, resolu: 230 },
  { name: 'Matete', signalements: 240, resolu: 190 },
  { name: 'Bandalungwa', signalements: 200, resolu: 170 },
  { name: 'Kintambo', signalements: 180, resolu: 150 },
];

const trendData = [
  { name: 'S1', value: 280 },
  { name: 'S2', value: 320 },
  { name: 'S3', value: 340 },
  { name: 'S4', value: 380 },
  { name: 'S5', value: 410 },
  { name: 'S6', value: 420 },
];

const communes = [
  { name: 'Gombe', population: '180K', activite: 92, status: 'Excellente' },
  { name: 'Lemba', population: '220K', activite: 85, status: 'Bonne' },
  { name: 'Ngaliema', population: '340K', activite: 78, status: 'Bonne' },
  { name: 'Matete', population: '290K', activite: 71, status: 'Moyenne' },
  { name: 'Bandalungwa', population: '310K', activite: 68, status: 'Moyenne' },
];

const statusColor: Record<string, string> = {
  'Excellente': 'bg-success/15 text-success border-success/30',
  'Bonne': 'bg-primary/15 text-primary border-primary/30',
  'Moyenne': 'bg-warning/15 text-warning border-warning/30',
};

export default function ProvinceDashboard() {
  return (
    <RoleGuard dashboard="province">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title="Dashboard Province — Kinshasa"
        description="Gestion provinciale et coordination des communes"
        icon={Building2}
        actions={<Badge variant="secondary">Province de Kinshasa</Badge>}
      />
      <DemoDataBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((k, i) => (
          <KpiCard key={k.title} {...k} delay={i * 0.05} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Signalements par commune" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={communeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="signalements" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Signalements" />
              <Bar dataKey="resolu" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Résolus" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle title="Tendance des signalements" />
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="provGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#provGrad)" strokeWidth={2} name="Signalements" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Communes de la province" action={<Badge variant="secondary">{communes.length}</Badge>} />
        <div className="grid gap-4 sm:grid-cols-2">
          {communes.map((c, i) => (
            <motion.div key={c.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.population} habitants</p>
                </div>
                <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${statusColor[c.status]}`}>{c.status}</span>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Activité</span>
                  <span className="font-medium">{c.activite}%</span>
                </div>
                <Progress value={c.activite} className="h-1.5" />
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
    </RoleGuard>
  );
}
