'use client';

import { motion } from 'framer-motion';
import {
  Shield, Landmark, Users, TrendingUp, CheckCircle2, AlertTriangle,
  Activity, Globe2, Building2, HeartPulse, Zap, Droplets,
} from 'lucide-react';
import {
  LineChart, Line, RadialBarChart, RadialBar, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from 'recharts';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const kpiData = [
  { title: 'Indice de développement numérique', value: '72%', change: '+8%', trend: 'up' as const, icon: TrendingUp, color: 'text-primary' },
  { title: 'Provinces connectées', value: '26/26', change: '+2', trend: 'up' as const, icon: Globe2, color: 'text-chart-2' },
  { title: 'Services numérisés', value: '48', change: '+12', trend: 'up' as const, icon: Building2, color: 'text-chart-3' },
  { title: 'Satisfaction citoyenne', value: '84%', change: '+6%', trend: 'up' as const, icon: CheckCircle2, color: 'text-success' },
];

const monthlyData = [
  { name: 'Jan', citoyens: 82000000, services: 32 },
  { name: 'Fév', citoyens: 85000000, services: 35 },
  { name: 'Mar', citoyens: 88000000, services: 38 },
  { name: 'Avr', citoyens: 90000000, services: 42 },
  { name: 'Mai', citoyens: 92000000, services: 45 },
  { name: 'Juin', citoyens: 95400000, services: 48 },
];

const sectorData = [
  { name: 'Santé', value: 87, fill: 'hsl(0 63% 55%)' },
  { name: 'Éducation', value: 72, fill: 'hsl(211 100% 50%)' },
  { name: 'Transport', value: 65, fill: 'hsl(142 71% 45%)' },
  { name: 'Énergie', value: 58, fill: 'hsl(45 93% 52%)' },
  { name: 'Eau', value: 51, fill: 'hsl(262 60% 65%)' },
];

const objectives = [
  { label: 'Numérisation des services', value: 78 },
  { label: 'Connectivité provinciale', value: 92 },
  { label: 'Inclusion citoyenne', value: 64 },
  { label: 'Souveraineté des données', value: 85 },
];

export default function NationalDashboard() {
  return (
    <RoleGuard dashboard="national">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title="Dashboard National"
        description="Vue stratégique nationale — République Démocratique du Congo"
        icon={Shield}
        actions={<Badge className="bg-success/15 text-success border-success/30">Données de démonstration</Badge>}
      />
      <DemoDataBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((k, i) => (
          <KpiCard key={k.title} {...k} delay={i * 0.05} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Croissance nationale" action={<Badge variant="secondary">6 mois</Badge>} />
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="citoyens" stroke="hsl(var(--primary))" strokeWidth={2} name="Citoyens" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="services" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Services" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle title="Performance par secteur" />
          <ResponsiveContainer width="100%" height={300}>
            <RadialBarChart innerRadius="20%" outerRadius="100%" data={sectorData} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={6} />
              <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
            </RadialBarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Objectifs 2035" />
          <div className="space-y-5">
            {objectives.map((o, i) => (
              <motion.div
                key={o.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{o.label}</span>
                  <span className="font-display font-semibold">{o.value}%</span>
                </div>
                <Progress value={o.value} className="h-2" />
              </motion.div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Indicateurs clés" />
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: HeartPulse, label: 'Hôpitaux connectés', value: '342', color: 'text-red-500' },
              { icon: Zap, label: 'Centres électriques', value: '128', color: 'text-amber-500' },
              { icon: Droplets, label: 'Stations d\'eau', value: '215', color: 'text-cyan-500' },
              { icon: Users, label: 'Agents terrain', value: '8.4K', color: 'text-primary' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-muted/30 p-4">
                <s.icon className={`mb-2 h-6 w-6 ${s.color}`} />
                <p className="font-display text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
    </RoleGuard>
  );
}
