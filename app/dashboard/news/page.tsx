'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, Calendar, ChevronRight, Search, AlertTriangle, CloudRain, Users, Zap } from 'lucide-react';
import { DashboardPageHeader, Card } from '@/components/dashboard/dashboard-primitives';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { RoleGuard } from '@/components/auth/role-guard';

interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  source: string;
  created_at: string;
}

const categoryConfig: Record<string, { label: string; icon: typeof Newspaper; color: string }> = {
  government: { label: 'Gouvernement', icon: Users, color: 'bg-blue-500/10 text-blue-500' },
  works: { label: 'Travaux', icon: Zap, color: 'bg-amber-500/10 text-amber-500' },
  traffic: { label: 'Circulation', icon: AlertTriangle, color: 'bg-orange-500/10 text-orange-500' },
  weather: { label: 'Météo', icon: CloudRain, color: 'bg-sky-500/10 text-sky-500' },
  alert: { label: 'Alerte', icon: AlertTriangle, color: 'bg-red-500/10 text-red-500' },
  event: { label: 'Évènement', icon: Calendar, color: 'bg-green-500/10 text-green-500' },
  info: { label: 'Information', icon: Newspaper, color: 'bg-muted text-muted-foreground' },
};

const fallbackNews = [
  {
    id: 'fb1',
    title: 'Lancement de la phase 2 du programme SMART CITY à Kinshasa',
    excerpt: 'Le Gouvernement annonce l\'extension de la plateforme à 10 nouvelles communes.',
    content: 'Dans le cadre de la transformation numérique, le Gouvernement de la RDC annonce l\'extension du programme SMART CITY à 10 nouvelles communes de Kinshasa. Cette phase 2 inclut le déploiement de 2,000 capteurs IoT supplémentaires pour la gestion intelligente de l\'éclairage public et des déchets.',
    category: 'government',
    source: 'Presidence de la République',
    created_at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: 'fb2',
    title: 'Travaux sur le Boulevard du 30 Juin — déviations recommandées',
    excerpt: 'Des travaux de réhabilitation débutent lundi sur 3 tronçons.',
    content: 'La Mairie de Kinshasa informe les citoyens que des travaux de réhabilitation routière débuteront lundi sur le Boulevard du 30 Juin. Trois tronçons seront concernés. Des déviations sont recommandées via le Boulevard Triomphal et l\'Avenue de la Justice.',
    category: 'works',
    source: 'Mairie de Kinshasa',
    created_at: new Date(Date.now() - 7200_000).toISOString(),
  },
  {
    id: 'fb3',
    title: 'Alerte météo : fortes pluies attendues dans 8 provinces',
    excerpt: 'L\'ACC Congo émet une alerte pour les prochaines 48 heures.',
    content: 'L\'Agence Congolaise de la Météorologie émet une alerte pour de fortes pluies dans 8 provinces du pays durant les prochaines 48 heures. Les citoyens sont invités à rester vigilants et à éviter les zones à risque d\'inondation.',
    category: 'weather',
    source: 'Agence Congolaise de la Météorologie',
    created_at: new Date(Date.now() - 14_400_000).toISOString(),
  },
  {
    id: 'fb4',
    title: 'Festival de la Jeunesse : grande manifestation au Stade des Martyrs',
    excerpt: 'Un événement culturel national se tiendra ce week-end.',
    content: 'Le Ministère de la Jeunesse organise un grand festival culturel au Stade des Martyrs ce samedi et dimanche. L\'évènement célébrera la jeunesse congolaise avec des concerts, des expositions et des activités sportives. L\'entrée est gratuite.',
    category: 'event',
    source: 'Ministère de la Jeunesse',
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<NewsArticle | null>(null);

  useEffect(() => {
    async function loadNews() {
      const { data } = await supabase
        .from('news_articles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        setArticles(data as NewsArticle[]);
      } else {
        setArticles(fallbackNews);
      }
      setLoading(false);
    }
    loadNews();
  }, []);

  const filtered = articles.filter((a) => {
    const matchCat = category === 'all' || a.category === category;
    const matchQuery = !query || a.title.toLowerCase().includes(query.toLowerCase()) || a.excerpt.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <RoleGuard dashboard="SHARED">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader
        title="Actualités"
        description="Communiqués officiels, alertes et informations gouvernementales"
        icon={Newspaper}
      />

      {/* Filters */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher une actualité..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Featured article */}
      {!selected && filtered.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="cursor-pointer overflow-hidden p-0 hover:shadow-lg transition-shadow" >
            <div className="grid gap-0 md:grid-cols-2">
              <div className="flex flex-col justify-center p-6 lg:p-8">
                <Badge className={cn('mb-3 w-fit', categoryConfig[filtered[0].category]?.color || categoryConfig.info.color)}>
                  {categoryConfig[filtered[0].category]?.label || 'Information'}
                </Badge>
                <h2 className="font-display text-xl font-bold sm:text-2xl">{filtered[0].title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{filtered[0].excerpt}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(filtered[0].created_at).toLocaleDateString('fr-FR')}</span>
                  <span>·</span>
                  <span>{filtered[0].source}</span>
                </div>
                <button onClick={() => setSelected(filtered[0])} className="mt-4 flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Lire l&rsquo;article complet <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="relative min-h-[200px] bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5">
                {(() => { const Icon = categoryConfig[filtered[0].category]?.icon || Newspaper; return <Icon className="absolute inset-0 m-auto h-24 w-24 text-primary/20" />; })()}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Article list */}
      {!selected && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/50" />)
          ) : filtered.length === 0 ? (
            <Card className="col-span-full py-12 text-center">
              <Newspaper className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucune actualité ne correspond à votre recherche.</p>
            </Card>
          ) : (
            filtered.slice(1).map((a, i) => {
              const cfg = categoryConfig[a.category] || categoryConfig.info;
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelected(a)}
                  className="cursor-pointer"
                >
                  <Card className="h-full transition-all hover:shadow-md hover:-translate-y-0.5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', cfg.color)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <h3 className="font-display text-sm font-semibold">{a.title}</h3>
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{a.excerpt}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-primary">
                      Lire plus <ChevronRight className="h-3 w-3" />
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Article detail modal */}
      {selected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl lg:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <Badge className={cn(categoryConfig[selected.category]?.color || categoryConfig.info.color)}>
                {categoryConfig[selected.category]?.label || 'Information'}
              </Badge>
              <button onClick={() => setSelected(null)} className="rounded-md p-1.5 hover:bg-muted">
                <ChevronRight className="h-5 w-5 rotate-45" />
              </button>
            </div>
            <h2 className="font-display text-2xl font-bold">{selected.title}</h2>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(selected.created_at).toLocaleDateString('fr-FR')}</span>
              <span>·</span>
              <span>{selected.source}</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{selected.content}</p>
          </motion.div>
        </motion.div>
      )}
    </div>
    </RoleGuard>
  );
}
