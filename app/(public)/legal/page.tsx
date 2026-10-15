'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/dashboard/dashboard-primitives';

export default function LegalPage() {
  return (
    <>
      <PageHeader badge="Informations légales" title="Mentions légales" subtitle="Cadre juridique de la plateforme SMART CITY RDC 2035" />
      <section className="py-16">
        <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
          <Card>
            <h2 className="font-display text-lg font-semibold">Éditeur de la plateforme</h2>
            <p className="mt-2 text-sm text-muted-foreground">Gouvernement de la République Démocratique du Congo — Ministère du Numérique. Avenue du Peuple, Kinshasa Gombe, RDC.</p>
          </Card>
          <Card>
            <h2 className="font-display text-lg font-semibold">Propriété intellectuelle</h2>
            <p className="mt-2 text-sm text-muted-foreground">L'ensemble des contenus de cette plateforme est la propriété de l'État congolais. Toute reproduction sans autorisation est interdite.</p>
          </Card>
          <Card>
            <h2 className="font-display text-lg font-semibold">Responsabilité</h2>
            <p className="mt-2 text-sm text-muted-foreground">La plateforme s'efforce de fournir des informations à jour. L'État ne saurait être tenu responsable des erreurs ou indisponibilités temporaires.</p>
          </Card>
        </div>
      </section>
    </>
  );
}
