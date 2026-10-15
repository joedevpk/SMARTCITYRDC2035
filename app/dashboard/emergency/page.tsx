'use client';

import { motion } from 'framer-motion';
import { Siren, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';

export default function EmergencyDashboard() {
  return (
    <RoleGuard dashboard="emergency">
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader
          title="Centre d'Urgences"
          description="Coordination des interventions d'urgence"
          icon={Siren}
        />
        <DemoDataBanner />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={AlertTriangle} title="Urgences actives" value="5" color="text-error" />
          <KpiCard icon={Siren} title="Interventions" value="8" color="text-warning" />
          <KpiCard icon={CheckCircle2} title="Résolues (24h)" value="32" color="text-success" />
          <KpiCard icon={Activity} title="Temps moyen" value="12 min" color="text-primary" />
        </div>
        <Card>
          <SectionTitle title="Interventions en cours" />
          <div className="space-y-2">
            {[
              { type: 'Évacuation', location: 'Kinshasa', status: 'En cours' },
              { type: 'Incendie', location: 'Lemba', status: 'En cours' },
              { type: 'Inondation', location: 'Masina', status: 'Résolu' },
            ].map((e, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">{e.type} — {e.location}</p>
                </div>
                <span className={`text-sm font-semibold ${e.status === 'Résolu' ? 'text-success' : 'text-warning'}`}>{e.status}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </RoleGuard>
  );
}
