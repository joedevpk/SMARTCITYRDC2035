'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Siren, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';

export default function PoliceDashboard() {
  return (
    <RoleGuard dashboard="police">
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader
          title="Centre de Commandement Police"
          description="Supervision des incidents, alertes et interventions"
          icon={ShieldCheck}
        />
        <DemoDataBanner />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={AlertTriangle} title="Incidents actifs" value="7" color="text-error" />
          <KpiCard icon={Siren} title="Interventions en cours" value="3" color="text-warning" />
          <KpiCard icon={CheckCircle2} title="Incidents résolus (24h)" value="24" color="text-success" />
          <KpiCard icon={Activity} title="Patrouilles actives" value="12" color="text-primary" />
        </div>
        <Card>
          <SectionTitle title="Incidents récents" />
          <div className="space-y-2">
            {[
              { type: 'Vol', location: 'Gombe', status: 'Actif', severity: 'high' },
              { type: 'Accident', location: 'Limete', status: 'En cours', severity: 'medium' },
              { type: 'Incendie', location: 'Matete', status: 'Résolu', severity: 'low' },
            ].map((inc, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">{inc.type} — {inc.location}</p>
                  <p className="text-xs text-muted-foreground">Sévérité: {inc.severity}</p>
                </div>
                <span className={`text-sm font-semibold ${inc.status === 'Résolu' ? 'text-success' : inc.status === 'Actif' ? 'text-error' : 'text-warning'}`}>{inc.status}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </RoleGuard>
  );
}
