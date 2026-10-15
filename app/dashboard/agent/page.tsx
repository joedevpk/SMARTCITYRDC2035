'use client';

import { motion } from 'framer-motion';
import { HardHat, FileText, CheckCircle2, Clock } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { RoleGuard } from '@/components/auth/role-guard';
import { DemoDataBanner } from '@/components/dashboard/data-provenance';

export default function AgentDashboard() {
  return (
    <RoleGuard dashboard="agent">
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader
          title="Espace Agent Terrain"
          description="Vos missions et interventions assignées"
          icon={HardHat}
        />
        <DemoDataBanner />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={FileText} title="Missions assignées" value="6" color="text-primary" />
          <KpiCard icon={Clock} title="En cours" value="2" color="text-warning" />
          <KpiCard icon={CheckCircle2} title="Terminées (mois)" value="18" color="text-success" />
          <KpiCard icon={HardHat} title="Taux de réussite" value="94%" color="text-accent" />
        </div>
        <Card>
          <SectionTitle title="Missions actives" />
          <div className="space-y-2">
            {[
              { title: 'Réparation lampadaire', location: 'Gombe', status: 'En cours' },
              { title: 'Inspection bac à déchets', location: 'Lemba', status: 'Assignée' },
              { title: 'Maintenance feux tricolores', location: 'Matete', status: 'En cours' },
            ].map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.location}</p>
                </div>
                <span className={`text-sm font-semibold ${m.status === 'En cours' ? 'text-primary' : 'text-muted-foreground'}`}>{m.status}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </RoleGuard>
  );
}
