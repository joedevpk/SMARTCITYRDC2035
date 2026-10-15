'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/lib/stores/i18n-store';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Adresse email invalide'),
  subject: z.string().min(3, 'Le sujet doit contenir au moins 3 caractères'),
  message: z.string().min(10, 'Le message doit contenir au moins 10 caractères'),
});

type FormData = z.infer<typeof schema>;

export default function ContactPage() {
  const { t } = useI18n();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitted(true);
    toast.success('Message envoyé avec succès', {
      description: 'Notre équipe vous répondra sous 48h.',
    });
    reset();
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <>
      <PageHeader
        badge="Nous écrire"
        title={t('contact.title')}
        subtitle={t('contact.subtitle')}
      />
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="space-y-6">
              {[
                { icon: MapPin, title: 'Adresse', value: 'Avenue du Peuple, Kinshasa Gombe, RDC' },
                { icon: Phone, title: 'Téléphone', value: '+243 80 000 0000' },
                { icon: Mail, title: 'Email', value: 'contact@smartcity-rdc.cd' },
              ].map((c) => (
                <div key={c.title} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold">{c.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 rounded-2xl border border-border bg-card p-8"
            >
              {submitted ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="mb-4 h-16 w-16 text-success" />
                  <h3 className="font-display text-xl font-semibold">Message envoyé !</h3>
                  <p className="mt-2 text-muted-foreground">
                    Merci de nous avoir contactés. Notre équipe vous répondra sous 48h.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom complet</Label>
                      <Input id="name" placeholder="Votre nom" {...register('name')} aria-invalid={!!errors.name} />
                      {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="vous@exemple.cd" {...register('email')} aria-invalid={!!errors.email} />
                      {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Sujet</Label>
                    <Input id="subject" placeholder="Objet de votre message" {...register('subject')} aria-invalid={!!errors.subject} />
                    {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" rows={5} placeholder="Décrivez votre demande..." {...register('message')} aria-invalid={!!errors.message} />
                    {errors.message && <p className="text-xs text-destructive">{errors.message.message}</p>}
                  </div>
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Envoi...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        {t('common.submit')}
                      </span>
                    )}
                  </Button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
