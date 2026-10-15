'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/dashboard/dashboard-primitives';

export default function PrivacyPage() {
  return (
    <>
      <PageHeader badge="Vos droits" title="Politique de confidentialité" subtitle="Protection des données personnelles des citoyens" />
      <section className="py-16">
        <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
          <Card>
            <h2 className="font-display text-lg font-semibold">Collecte des données</h2>
            <p className="mt-2 text-sm text-muted-foreground">La plateforme collecte uniquement les données nécessaires à la fourniture des services publics : nom, email, téléphone et position GPS lors des signalements.</p>
          </Card>
          <Card>
            <h2 className="font-display text-lg font-semibold">Utilisation</h2>
            <p className="mt-2 text-sm text-muted-foreground">Vos données sont utilisées pour traiter vos signalements, vous informer et améliorer les services publics. Elles ne sont jamais vendues à des tiers.</p>
          </Card>
          <Card>
            <h2 className="font-display text-lg font-semibold">Hébergement souverain</h2>
            <p className="mt-2 text-sm text-muted-foreground">Toutes les données sont hébergées sur une infrastructure nationale sécurisée, sous juridiction congolaise.</p>
          </Card>
          <Card>
            <h2 className="font-display text-lg font-semibold">Vos droits</h2>
            <p className="mt-2 text-sm text-muted-foreground">Vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Contactez-nous via la page Contact.</p>
          </Card>
        </div>
      </section>
    </>
  );
}
