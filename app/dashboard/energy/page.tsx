'use client';

import { motion } from 'framer-motion';
import { Zap, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';

export default function EnergyDashboard() {
  return (
    <RoleGuard dashboard="energy">
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader
          title="Service de l'Énergie"
          description="Centrales, lampadaires, consommation et coupures"
          icon={Zap}
        />
        <DemoDataBanner />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Zap} title="Production (MW)" value="456" color="text-primary" />
          <KpiCard icon={AlertTriangle} title="Coupures actives" value="3" color="text-error" />
          <KpiCard icon={CheckCircle2} title="Lampadaires actifs" value="1 248" color="text-success" />
          <KpiCard icon={Activity} title="Charge réseau" value="72%" color="text-warning" />
        </div>
        <Card>
          <SectionTitle title="Centrales électriques" />
          <div className="space-y-2">
            {[
              { name: 'Centrale Inga I', status: 'Opérationnel', output: '180 MW' },
              { name: 'Centrale Inga II', status: 'Opérationnel', output: '240 MW' },
              { name: 'Solaire Lubumbashi', status: 'Maintenance', output: '0 MW' },
            ].map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">Production: {c.output}</p>
                </div>
                <span className={`text-sm font-semibold ${c.status === 'Opérationnel' ? 'text-success' : 'text-warning'}`}>{c.status}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </RoleGuard>
  );
}
