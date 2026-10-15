'use client';

import { motion } from 'framer-motion';
import { Trash2, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';

export default function WasteDashboard() {
  return (
    <RoleGuard dashboard="waste">
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader
          title="Service des Déchets"
          description="Bacs, camions, tournées et collectes"
          icon={Trash2}
        />
        <DemoDataBanner />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Trash2} title="Bacs collectés" value="342" color="text-primary" />
          <KpiCard icon={AlertTriangle} title="Bacs pleins" value="18" color="text-warning" />
          <KpiCard icon={CheckCircle2} title="Tournées actives" value="6" color="text-success" />
          <KpiCard icon={Activity} title="Taux de collecte" value="84%" color="text-accent" />
        </div>
        <Card>
          <SectionTitle title="Tournées de collecte" />
          <div className="space-y-2">
            {[
              { route: 'Gombe — Centre', status: 'En cours', bins: 24 },
              { route: 'Lemba — Sud', status: 'Terminée', bins: 18 },
              { route: 'Matete — Nord', status: 'Planifiée', bins: 32 },
            ].map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">{r.route}</p>
                  <p className="text-xs text-muted-foreground">{r.bins} bacs</p>
                </div>
                <span className={`text-sm font-semibold ${r.status === 'Terminée' ? 'text-success' : r.status === 'En cours' ? 'text-primary' : 'text-muted-foreground'}`}>{r.status}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </RoleGuard>
  );
}
