'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/lib/stores/i18n-store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('Adresse email invalide'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!isSupabaseConfigured) {
      toast.error('Backend non configuré', { description: 'Réinitialisation indisponible : la connexion au serveur n\'est pas configurée.' });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error('Erreur', { description: error.message });
      return;
    }

    setSent(true);
    toast.success('Lien envoyé', { description: `Un email a été envoyé à ${data.email}` });
  };

  return (
    <AuthShell title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      {sent ? (
        <div className="space-y-6 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          <div>
            <h3 className="font-display text-lg font-semibold">Vérifiez votre boîte mail</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Nous avons envoyé un lien de réinitialisation à votre adresse email.
              Le lien est valide pendant 30 minutes.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('nav.login')}
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" className="pl-9" placeholder="vous@smartcity-rdc.cd" {...register('email')} aria-invalid={!!errors.email} />
            </div>
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                {t('common.loading')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                {t('auth.forgot.button')}
              </span>
            )}
          </Button>
          <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')} à la connexion
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
