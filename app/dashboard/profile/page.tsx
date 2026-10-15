'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Camera, Save, Lock, Globe, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuth, roleLabels } from '@/lib/stores/auth-store';
import { supabase } from '@/lib/supabase/client';
import { useI18n } from '@/lib/stores/i18n-store';
import { languages } from '@/lib/i18n';
import { RoleGuard } from '@/components/auth/role-guard';

const schema = z.object({
  name: z.string().min(2, 'Nom invalide'),
  email: z.string().email('Email invalide'),
  phone: z.string().min(8, 'Téléphone invalide'),
  province: z.string().min(2, 'Province requise'),
  commune: z.string().min(2, 'Commune requise'),
});
type FormData = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [avatar, setAvatar] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: '+243 80 000 0000',
      province: user?.province ?? 'Kinshasa',
      commune: user?.commune ?? 'Gombe',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: data.name, email: data.email })
      .eq('id', user.id);
    if (error) {
      toast.error('Erreur lors de la mise à jour du profil');
      return;
    }
    setUser({ ...user, name: data.name, email: data.email, province: data.province, commune: data.commune });
    toast.success('Profil mis à jour');
  };

  const onAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAvatar(reader.result as string);
        if (user) setUser({ ...user, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
      toast.success('Photo mise à jour');
    }
  };

  return (
    <RoleGuard dashboard="SHARED">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader title="Mon profil" description="Gérez vos informations personnelles" icon={User} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-3xl font-bold text-primary">
            {avatar ? <img src={avatar} alt="Avatar" className="h-full w-full object-cover" /> : (user?.name?.charAt(0).toUpperCase() ?? 'U')}
          </div>
          <h3 className="font-display text-lg font-semibold">{user?.name}</h3>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <Badge className="mt-3" variant="secondary">{roleLabels[user?.role ?? 'citizen']?.fr}</Badge>
          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-2 text-sm text-muted-foreground transition-colors hover:bg-muted">
            <Camera className="h-4 w-4" /> Changer la photo
            <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
          </label>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title="Informations personnelles" />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" className="pl-9" {...register('name')} aria-invalid={!!errors.name} />
                </div>
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" className="pl-9" {...register('email')} aria-invalid={!!errors.email} />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="phone" className="pl-9" {...register('phone')} aria-invalid={!!errors.phone} />
                </div>
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="province" className="pl-9" {...register('province')} aria-invalid={!!errors.province} />
                </div>
                {errors.province && <p className="text-xs text-destructive">{errors.province.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="commune">Commune</Label>
                <Input id="commune" {...register('commune')} aria-invalid={!!errors.commune} />
                {errors.commune && <p className="text-xs text-destructive">{errors.commune.message}</p>}
              </div>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Enregistrement...</span>
              ) : (
                <span className="flex items-center gap-2"><Save className="h-4 w-4" /> {t('common.save')}</span>
              )}
            </Button>
          </form>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Langue préférée" />
          <div className="grid grid-cols-2 gap-3">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); toast.success('Langue mise à jour'); }}
                className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${lang === l.code ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
              >
                <span className="text-lg">{l.flag}</span> {l.name}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Préférences de notification" />
          <div className="space-y-4">
            {[
              { label: 'Notifications par email', desc: 'Recevoir les mises à jour par email', default: true },
              { label: 'Notifications SMS', desc: 'Recevoir les alertes par SMS', default: true },
              { label: 'Alertes temps réel', desc: 'Notifications push instantanées', default: false },
              { label: 'Rapports hebdomadaires', desc: 'Synthèse des activités chaque semaine', default: true },
            ].map((p) => (
              <div key={p.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <Switch defaultChecked={p.default} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Sécurité" />
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Mot de passe</p>
                <p className="text-xs text-muted-foreground">Dernière modification: il y a 30 jours</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info('Email envoyé pour réinitialisation')}>Modifier</Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Authentification à deux facteurs</p>
                <p className="text-xs text-muted-foreground">Sécurisez votre compte avec un code OTP</p>
              </div>
            </div>
            <Switch />
          </div>
        </div>
      </Card>
    </div>
    </RoleGuard>
  );
}
