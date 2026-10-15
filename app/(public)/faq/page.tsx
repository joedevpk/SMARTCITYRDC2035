'use client';

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/lib/stores/i18n-store';
import { PageHeader } from '@/components/shared/page-header';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const faqs = [
  { q: "Qu'est-ce que SMART CITY RDC 2035 ?", a: "C'est la plateforme nationale intelligente de gestion urbaine du Gouvernement de la République Démocratique du Congo, conçue pour connecter toutes les institutions publiques et les citoyens dans un écosystème numérique unifié." },
  { q: "Qui peut utiliser la plateforme ?", a: "La plateforme est accessible à tous : citoyens, agents terrain, communes, provinces, ministères et gouvernement. Chaque rôle dispose d'un espace dédié et adapté à ses besoins." },
  { q: "Comment créer un compte citoyen ?", a: "Rendez-vous sur la page d'inscription, choisissez le rôle 'Citoyen', renseignez vos informations et validez. Vous recevrez un code de confirmation par email." },
  { q: "La plateforme est-elle disponible en swahili et lingala ?", a: "Oui, la plateforme est entièrement multilingue : français, anglais, swahili et lingala. Vous pouvez changer de langue à tout moment depuis l'en-tête." },
  { q: "Mes données sont-elles sécurisées ?", a: "Toutes les données sont chiffrées et hébergées sur une infrastructure souveraine. La plateforme respecte les standards de sécurité gouvernementaux et la confidentialité des citoyens." },
  { q: "Comment signaler un problème urbain ?", a: "Depuis votre espace citoyen, cliquez sur 'Nouveau signalement', décrivez le problème, ajoutez une photo et votre position GPS sera détectée automatiquement. Vous suivrez ensuite l'intervention en temps réel." },
  { q: "La plateforme fonctionne-t-elle hors connexion ?", a: "Une version allégée est disponible pour les zones à faible connectivité. Les signalements sont synchronisés dès que la connexion est rétablie." },
  { q: "Comment contacter le support ?", a: "Vous pouvez utiliser le formulaire de contact sur la page Contact, ou envoyer un email à contact@smartcity-rdc.cd. Notre équipe répond sous 48h." },
];

export default function FaqPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        badge="Aide"
        title={t('faq.title')}
        subtitle={t('faq.subtitle')}
      />
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
              >
                <AccordionItem value={`item-${i}`} className="rounded-lg border border-border bg-card px-5">
                  <AccordionTrigger className="text-left font-display font-semibold hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}
