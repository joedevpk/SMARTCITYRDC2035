'use client';

import { motion } from 'framer-motion';
import { Building2, Landmark, Globe2, Cpu } from 'lucide-react';
import { useI18n } from '@/lib/stores/i18n-store';
import { PageHeader } from '@/components/shared/page-header';

const partners = [
  { name: 'Ministère du Numérique', type: 'Gouvernement', icon: Landmark },
  { name: 'Vodacom RDC', type: 'Télécoms', icon: Globe2 },
  { name: 'Orange RDC', type: 'Télécoms', icon: Globe2 },
  { name: 'Africa Data Center', type: 'Infrastructure', icon: Building2 },
  { name: 'Smart Africa', type: 'Alliance panafricaine', icon: Globe2 },
  { name: 'Banque Mondiale', type: 'Partenaire financier', icon: Building2 },
  { name: 'Union Africaine', type: 'Institution', icon: Landmark },
  { name: 'Orange Digital Center', type: 'Innovation', icon: Cpu },
  { name: 'Kinshasa Digital', type: 'Innovation', icon: Cpu },
  { name: 'GIZ', type: 'Coopération', icon: Building2 },
  { name: 'Airtel RDC', type: 'Télécoms', icon: Globe2 },
  { name: 'UNICEF RDC', type: 'Coopération', icon: Building2 },
];

export default function PartnersPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        badge="12 partenaires"
        title={t('partners.title')}
        subtitle={t('partners.subtitle')}
      />
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <p.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.type}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
