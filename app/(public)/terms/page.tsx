'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/dashboard/dashboard-primitives';

export default function TermsPage() {
  return (
    <>
      <PageHeader badge="Cadre d'utilisation" title="Conditions d'utilisation" subtitle="Règles d'usage de la plateforme SMART CITY RDC 2035" />
      <section className="py-16">
        <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
          <Card>
            <h2 className="font-display text-lg font-semibold">Acceptation</h2>
            <p className="mt-2 text-sm text-muted-foreground">L'utilisation de la plateforme implique l'acceptation des présentes conditions d'utilisation.</p>
          </Card>
          <Card>
            <h2 className="font-display text-lg font-semibold">Comportement utilisateur</h2>
            <p className="mt-2 text-sm text-muted-foreground">Les utilisateurs s'engagent à fournir des informations véridiques et à ne pas utiliser la plateforme à des fins frauduleuses.</p>
          </Card>
          <Card>
            <h2 className="font-display text-lg font-semibold">Signalements</h2>
            <p className="mt-2 text-sm text-muted-foreground">Les signalements sont traités selon leur priorité. Les fausses déclarations peuvent entraîner la suspension du compte.</p>
          </Card>
          <Card>
            <h2 className="font-display text-lg font-semibold">Modification des conditions</h2>
            <p className="mt-2 text-sm text-muted-foreground">Le Gouvernement se réserve le droit de modifier les conditions d'utilisation à tout moment.</p>
          </Card>
        </div>
      </section>
    </>
  );
}
