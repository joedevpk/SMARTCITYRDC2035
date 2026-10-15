'use client';

import { Settings, Moon, Sun, Globe, Bell, Shield, Palette } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { DashboardPageHeader, Card, SectionTitle } from '@/components/dashboard/dashboard-primitives';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/lib/stores/i18n-store';
import { languages } from '@/lib/i18n';
import { RoleGuard } from '@/components/auth/role-guard';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { lang, setLang } = useI18n();

  return (
    <RoleGuard dashboard="SHARED">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader title="Paramètres" description="Personnalisez votre expérience" icon={Settings} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Apparence" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
                <div>
                  <p className="text-sm font-medium">Thème</p>
                  <p className="text-xs text-muted-foreground">Mode clair ou sombre</p>
                </div>
              </div>
              <Select value={theme} onValueChange={(v) => { setTheme(v); toast.success('Thème mis à jour'); }}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Clair</SelectItem>
                  <SelectItem value="dark">Sombre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Palette className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Animations</p>
                  <p className="text-xs text-muted-foreground">Transitions et micro-interactions</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Langue & région" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Langue de l&rsquo;interface</p>
                  <p className="text-xs text-muted-foreground">{languages.find((l) => l.code === lang)?.name}</p>
                </div>
              </div>
              <Select value={lang} onValueChange={(v) => { setLang(v as typeof lang); toast.success('Langue mise à jour'); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {languages.map((l) => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Sons de notification</p>
                  <p className="text-xs text-muted-foreground">Alerte sonore pour les notifications</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Confidentialité" />
          <div className="space-y-4">
            {[
              { label: 'Partager mes données d\&rsquo;utilisation', desc: 'Aider à améliorer la plateforme', default: true },
              { label: 'Géolocalisation', desc: 'Détecter ma position pour les signalements', default: true },
              { label: 'Profil visible par les agents', desc: 'Permettre aux agents de me contacter', default: false },
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

        <Card>
          <SectionTitle title="Sécurité du compte" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Double authentification</p>
                  <p className="text-xs text-muted-foreground">Protection renforcée</p>
                </div>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Alertes de connexion</p>
                  <p className="text-xs text-muted-foreground">Notification à chaque connexion</p>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
            <Button variant="outline" className="w-full" onClick={() => toast.info('Téléchargement de vos données...')}>
              Télécharger mes données
            </Button>
          </div>
        </Card>
      </div>
    </div>
    </RoleGuard>
  );
}
