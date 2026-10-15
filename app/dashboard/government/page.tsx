'use client';

import { motion } from 'framer-motion';
import {
  Building2, Users, FileText, CheckCircle2, Clock, AlertTriangle, Briefcase, Landmark,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';
import { Badge } from '@/components/ui/badge';

const kpiData = [
  { title: 'Ministères actifs', value: '32', change: '+2', trend: 'up' as const, icon: Landmark, color: 'text-primary' },
  { title: 'Agents publics', value: '124K', change: '+8K', trend: 'up' as const, icon: Users, color: 'text-chart-2' },
  { title: 'Dossiers traités (mois)', value: '48.2K', change: '+15%', trend: 'up' as const, icon: FileText, color: 'text-chart-3' },
  { title: 'Efficacité administrative', value: '79%', change: '+4%', trend: 'up' as const, icon: CheckCircle2, color: 'text-success' },
];

const ministryData = [
  { name: 'Numérique', dossiers: 3200, resolu: 2800 },
  { name: 'Santé', dossiers: 5400, resolu: 4600 },
  { name: 'Éducation', dossiers: 6100, resolu: 5200 },
  { name: 'Transport', dossiers: 2800, resolu: 2100 },
  { name: 'Intérieur', dossiers: 3400, resolu: 2900 },
  { name: 'Finances', dossiers: 4200, resolu: 3800 },
];

const efficiencyData = [
  { name: 'S1', valeur: 62 },
  { name: 'S2', valeur: 68 },
  { name: 'S3', valeur: 71 },
  { name: 'S4', valeur: 74 },
  { name: 'S5', valeur: 77 },
  { name: 'S6', valeur: 79 },
];

const ministries = [
  { name: 'Ministère du Numérique', minister: 'M. KAYEMBE', status: 'Actif', dossiers: 3200 },
  { name: 'Ministère de la Santé', minister: 'Mme LUKUSA', status: 'Actif', dossiers: 5400 },
  { name: 'Ministère de l\'Éducation', minister: 'M. MABILA', status: 'Actif', dossiers: 6100 },
  { name: 'Ministère des Transports', minister: 'M. KASAÏ', status: 'En révision', dossiers: 2800 },
  { name: 'Ministère de l\'Intérieur', minister: 'M. BEMBA', status: 'Actif', dossiers: 3400 },
];

export default function GovernmentDashboard() {
  return (
    <RoleGuard dashboard="government">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title="Dashboard Gouvernement"
        description="Coordination des ministères et services publics"
        icon={Building2}
      />
      <DemoDataBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((k, i) => (
          <KpiCard key={k.title} {...k} delay={i * 0.05} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Dossiers par ministère" action={<Badge variant="secondary">6 mois</Badge>} />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ministryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="dossiers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Dossiers" />
              <Bar dataKey="resolu" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Résolus" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle title="Efficacité administrative" />
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={efficiencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              <Line type="monotone" dataKey="valeur" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} name="Efficacité (%)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Ministères" action={<Badge variant="secondary">{ministries.length} actifs</Badge>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Ministère</th>
                <th className="pb-2 font-medium">Ministre</th>
                <th className="pb-2 font-medium">Statut</th>
                <th className="pb-2 font-medium">Dossiers</th>
              </tr>
            </thead>
            <tbody>
              {ministries.map((m) => (
                <tr key={m.name} className="border-b border-border/50 last:border-0">
                  <td className="py-3 font-medium">{m.name}</td>
                  <td className="py-3 text-muted-foreground">{m.minister}</td>
                  <td className="py-3">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${m.status === 'Actif' ? 'bg-success/15 text-success border-success/30' : 'bg-warning/15 text-warning border-warning/30'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 font-display font-semibold">{m.dossiers.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Clock, label: 'En attente', value: '1.2K', color: 'text-muted-foreground' },
          { icon: AlertTriangle, label: 'En retard', value: '340', color: 'text-warning' },
          { icon: Briefcase, label: 'Priorité haute', value: '89', color: 'text-destructive' },
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
