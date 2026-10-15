'use client';

import { motion } from 'framer-motion';
import {
  Landmark, Crown, TrendingUp, Globe2, Users, ShieldCheck, Star, Award,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Bar, Line, BarChart,
} from 'recharts';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const kpiData = [
  { title: 'Indice de gouvernance', value: '89', change: '+4', trend: 'up' as const, icon: Crown, color: 'text-accent' },
  { title: 'Confiance citoyenne', value: '91%', change: '+7%', trend: 'up' as const, icon: Star, color: 'text-primary' },
  { title: 'Projets nationaux', value: '156', change: '+23', trend: 'up' as const, icon: Award, color: 'text-chart-2' },
  { title: 'Coopération internationale', value: '24', change: '+3', trend: 'up' as const, icon: Globe2, color: 'text-chart-3' },
];

const governanceData = [
  { name: 'Jan', indice: 78, projets: 12, citoyens: 82 },
  { name: 'Fév', indice: 80, projets: 18, citoyens: 83 },
  { name: 'Mar', indice: 83, projets: 22, citoyens: 85 },
  { name: 'Avr', indice: 85, projets: 28, citoyens: 87 },
  { name: 'Mai', indice: 87, projets: 35, citoyens: 89 },
  { name: 'Juin', indice: 89, projets: 42, citoyens: 91 },
];

const priorities = [
  { label: 'Sécurité nationale', value: 94 },
  { label: 'Souveraineté numérique', value: 88 },
  { label: 'Développement économique', value: 76 },
  { label: 'Cohésion sociale', value: 82 },
  { label: 'Diplomatie numérique', value: 71 },
];

const provinces = [
  { name: 'Kinshasa', score: 92 },
  { name: 'Haut-Katanga', score: 87 },
  { name: 'Nord-Kivu', score: 78 },
  { name: 'Sud-Kivu', score: 75 },
  { name: 'Kongo Central', score: 81 },
  { name: 'Lualaba', score: 84 },
];

export default function PresidentialDashboard() {
  return (
    <RoleGuard dashboard="presidential">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title="Dashboard Présidentiel"
        description="Vue d'ensemble de la République — Haut commandement"
        icon={Landmark}
        actions={<Badge className="bg-accent/15 text-accent border-accent/30">Niveau Présidence</Badge>}
      />
      <DemoDataBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((k, i) => (
          <KpiCard key={k.title} {...k} delay={i * 0.05} />
        ))}
      </div>

      <Card>
        <SectionTitle title="Évolution de la gouvernance" action={<Badge variant="secondary">6 mois</Badge>} />
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={governanceData}>
            <defs>
              <linearGradient id="govGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="indice" fill="url(#govGrad)" stroke="hsl(var(--accent))" strokeWidth={2} name="Indice de gouvernance" />
            <Bar dataKey="projets" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Projets lancés" barSize={20} />
            <Line type="monotone" dataKey="citoyens" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Confiance citoyenne (%)" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Priorités nationales" />
          <div className="space-y-5">
            {priorities.map((p, i) => (
              <motion.div key={p.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{p.label}</span>
                  <span className="font-display font-semibold">{p.value}%</span>
                </div>
                <Progress value={p.value} className="h-2" />
              </motion.div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Performance provinciale" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={provinces} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Bar dataKey="score" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
    </RoleGuard>
  );
}
