'use client';

import { motion } from 'framer-motion';
import {
  Home, Users, FileText, CheckCircle2, Clock, AlertTriangle, MapPin,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';
import { Badge } from '@/components/ui/badge';

const kpiData = [
  { title: 'Habitants commune', value: '180K', change: '+0.4%', trend: 'up' as const, icon: Users, color: 'text-primary' },
  { title: 'Signalements (mois)', value: '420', change: '+8%', trend: 'up' as const, icon: FileText, color: 'text-chart-3' },
  { title: 'Interventions', value: '380', change: '+12%', trend: 'up' as const, icon: CheckCircle2, color: 'text-success' },
  { title: 'Agents actifs', value: '24', change: '+3', trend: 'up' as const, icon: MapPin, color: 'text-chart-2' },
];

const categoryData = [
  { name: 'Voirie', value: 120, color: 'hsl(211 100% 50%)' },
  { name: 'Éclairage', value: 95, color: 'hsl(45 93% 52%)' },
  { name: 'Déchets', value: 85, color: 'hsl(142 71% 45%)' },
  { name: 'Eau', value: 60, color: 'hsl(262 60% 65%)' },
  { name: 'Sécurité', value: 40, color: 'hsl(0 63% 55%)' },
];

const weeklyData = [
  { name: 'Lun', ouverts: 12, resolus: 8 },
  { name: 'Mar', ouverts: 15, resolus: 11 },
  { name: 'Mer', ouverts: 18, resolus: 14 },
  { name: 'Jeu', ouverts: 14, resolus: 10 },
  { name: 'Ven', ouverts: 22, resolus: 16 },
  { name: 'Sam', ouverts: 10, resolus: 7 },
  { name: 'Dim', ouverts: 6, resolus: 4 },
];

const agents = [
  { name: 'KAYEMBE M.', role: 'Voirie', status: 'En intervention', color: 'bg-success/15 text-success' },
  { name: 'LUKUSA J.', role: 'Éclairage', status: 'Disponible', color: 'bg-primary/15 text-primary' },
  { name: 'MABILA P.', role: 'Déchets', status: 'En intervention', color: 'bg-success/15 text-success' },
  { name: 'KASAÏ A.', role: 'Eau', status: 'En pause', color: 'bg-warning/15 text-warning' },
];

export default function CommuneDashboard() {
  return (
    <RoleGuard dashboard="commune">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title="Dashboard Commune — Gombe"
        description="Gestion communale et suivi des interventions"
        icon={Home}
        actions={<Badge variant="secondary">Commune de Gombe</Badge>}
      />
      <DemoDataBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((k, i) => (
          <KpiCard key={k.title} {...k} delay={i * 0.05} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle title="Signalements par catégorie" />
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title="Activité hebdomadaire" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ouverts" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} name="Ouverts" />
              <Bar dataKey="resolus" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Résolus" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Agents terrain" action={<Badge variant="secondary">{agents.length} agents</Badge>} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {agents.map((a, i) => (
            <motion.div key={a.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
                  {a.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.role}</p>
                </div>
              </div>
              <span className={`mt-3 inline-block rounded-full border border-border px-2 py-0.5 text-xs ${a.color}`}>
                {a.status}
              </span>
            </motion.div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Clock, label: 'En attente', value: '42', color: 'text-muted-foreground' },
          { icon: AlertTriangle, label: 'Priorité haute', value: '8', color: 'text-destructive' },
          { icon: CheckCircle2, label: 'Résolus (jour)', value: '24', color: 'text-success' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
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
