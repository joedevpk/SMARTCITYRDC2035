'use client';

import { motion } from 'framer-motion';
import { Bus, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';

export default function TransportDashboard() {
  return (
    <RoleGuard dashboard="transport">
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader
          title="Service des Transports"
          description="Trafic, routes, feux et embouteillages"
          icon={Bus}
        />
        <DemoDataBanner />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Bus} title="Bus en service" value="84" color="text-primary" />
          <KpiCard icon={AlertTriangle} title="Embouteillages" value="5" color="text-warning" />
          <KpiCard icon={CheckCircle2} title="Feux fonctionnels" value="248" color="text-success" />
          <KpiCard icon={Activity} title="Trafic moyen" value="Modéré" color="text-accent" />
        </div>
        <Card>
          <SectionTitle title="Points de congestion" />
          <div className="space-y-2">
            {[
              { road: 'Boulevard du 30 Juin', level: 'Élevé', delay: '15 min' },
              { road: 'Avenue Kasa-Vubu', level: 'Modéré', delay: '8 min' },
              { road: 'Route Matadi', level: 'Fluide', delay: '0 min' },
            ].map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">{r.road}</p>
                  <p className="text-xs text-muted-foreground">Retard: {r.delay}</p>
                </div>
                <span className={`text-sm font-semibold ${r.level === 'Fluide' ? 'text-success' : r.level === 'Élevé' ? 'text-error' : 'text-warning'}`}>{r.level}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </RoleGuard>
  );
}
