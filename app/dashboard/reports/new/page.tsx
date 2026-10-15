'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Camera, MapPin, Send, ArrowLeft, CheckCircle2, Type, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardPageHeader, Card } from '@/components/dashboard/dashboard-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/stores/auth-store';
import { RoleGuard } from '@/components/auth/role-guard';
import { MAX_ATTACHMENTS, uploadReportImages, validateImage, type ValidatedImage } from '@/lib/report-attachments';

const schema = z.object({
  category: z.string().min(1, 'Veuillez choisir une catégorie'),
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères'),
  location: z.string().min(3, 'Veuillez indiquer la localisation'),
  description: z.string().min(10, 'La description doit contenir au moins 10 caractères'),
  priority: z.string().min(1, 'Veuillez choisir une priorité'),
});
type FormData = z.infer<typeof schema>;

const categories = [
  { value: 'waste', label: 'Déchets', icon: '🗑️' },
  { value: 'lighting', label: 'Lampadaire en panne', icon: '💡' },
  { value: 'traffic', label: 'Embouteillage', icon: '🚦' },
  { value: 'water', label: "Fuite d'eau", icon: '💧' },
  { value: 'power', label: 'Coupure électrique', icon: '⚡' },
  { value: 'security', label: 'Sécurité', icon: '🚨' },
  { value: 'road', label: 'Route dégradée', icon: '🛣️' },
  { value: 'other', label: 'Autre', icon: '📋' },
];
const priorities = [
  { value: 'low', label: 'Basse', desc: 'Nuisance mineure', color: 'text-muted-foreground' },
  { value: 'medium', label: 'Moyenne', desc: 'Problème significatif', color: 'text-warning' },
  { value: 'high', label: 'Haute', desc: 'Urgent, impact important', color: 'text-orange-500' },
  { value: 'critical', label: 'Critique', desc: 'Danger immédiat', color: 'text-destructive' },
];

export default function NewReportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [submittedReport, setSubmittedReport] = useState<{ reference: string; createdAt: string; category: string; priority: string; photoNote: string | null } | null>(null);
  const [images, setImages] = useState<{ v: ValidatedImage; preview: string }[]>([]);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Position handed over by the map ("Signaler un problème ici"): /dashboard/reports/new?lat=..&lng=..
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const lat = Number(q.get('lat'));
    const lng = Number(q.get('lng'));
    if (q.get('lat') && q.get('lng') && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      setGps({ lat, lng });
      setValue('location', `Position choisie sur la carte : ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => images.forEach((i) => URL.revokeObjectURL(i.preview)), [images]);

  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const f of files) {
      if (images.length >= MAX_ATTACHMENTS) { toast.error(`Maximum ${MAX_ATTACHMENTS} photos par signalement.`); break; }
      const res = await validateImage(f);
      if (!res.ok) { toast.error('Image refusée', { description: res.error }); continue; }
      setImages((prev) => (prev.length >= MAX_ATTACHMENTS ? prev : [...prev, { v: res.value, preview: URL.createObjectURL(f) }]));
    }
  };

  const detectGps = () => {
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non supportée');
      return;
    }
    toast.info('Détection de votre position...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(coords);
        setValue('location', `Position GPS: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        toast.success('Position détectée', { description: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` });
      },
      (err) => {
        const reason =
          err.code === err.PERMISSION_DENIED ? 'Autorisation de localisation refusée. Choisissez la position sur la carte ou saisissez une adresse.'
          : err.code === err.POSITION_UNAVAILABLE ? 'Position indisponible (pas de signal GPS ou de réseau).'
          : 'Délai dépassé pendant la localisation.';
        toast.error('Impossible de détecter votre position', { description: reason });
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const onSubmit = async (data: FormData) => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }

    const insertBody: any = {
      category: data.category,
      title: data.title,
      description: data.description,
      priority: data.priority,
      // status / reporter are set by the database (trigger) — never trusted from the browser.
      address: data.location,
    };

    if (gps) {
      insertBody.location = `SRID=4326;POINT(${gps.lng} ${gps.lat})`;
    }

    const { data: report, error } = await supabase
      .from('reports')
      .insert(insertBody)
      .select()
      .single();

    if (error) {
      toast.error('Erreur lors de la création', { description: error.message });
      return;
    }

    // La confirmation n'est affichée qu'après l'enregistrement effectif. Les photos sont envoyées ensuite :
    // un échec partiel ne perd pas le signalement (déjà enregistré) et est annoncé explicitement.
    let photoNote: string | null = null;
    if (images.length > 0) {
      const res = await uploadReportImages(supabase, user.id, report.id, images.map((i) => i.v));
      if (res.verification === 'failed') photoNote = 'Signalement enregistré ; la vérification des photos n\'a pas pu aboutir. Elles ne seront visibles qu\'après vérification (réessayez plus tard).';
      else if (res.failed.length === 0) photoNote = `${res.uploaded} photo(s) jointe(s).`;
      else {
        photoNote = `Signalement enregistré, mais ${res.failed.length} photo(s) n'ont pas pu être jointes (${res.failed.map((f) => f.name).join(', ')}). ${res.uploaded} photo(s) jointe(s).`;
        toast.warning('Photos non jointes', { description: res.failed[0].reason });
      }
    }

    setSubmittedReport({
      reference: report.reference,
      createdAt: new Date().toISOString(),
      category: data.category,
      priority: data.priority,
      photoNote,
    });
    toast.success('Signalement envoyé', { description: `Référence: ${report.reference}` });
  };

  if (submittedReport) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <DashboardPageHeader title="Signalement envoyé" icon={CheckCircle2} />
        <Card className="max-w-lg text-center">
          <div className="py-8">
            <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', duration: 0.6 }} className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </motion.div>
            <h2 className="font-display text-xl font-semibold">Signalement enregistré !</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Votre signalement est enregistré dans la plateforme. Sa prise en charge par les services publics dépend de leur raccordement : aucun délai d’intervention n’est garanti. Vous pouvez suivre son statut dans « Mes signalements ».
            </p>
            <div className="mt-6 rounded-xl border border-border bg-muted/30 p-5 text-left">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Numéro de dossier</p>
                  <p className="font-mono font-semibold">{submittedReport.reference}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date & heure</p>
                  <p className="font-medium">{new Date(submittedReport.createdAt).toLocaleString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium">En attente</span>
                </div>
                {submittedReport.photoNote && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Photos</p>
                    <p className="font-medium">{submittedReport.photoNote}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Délai de traitement</p>
                  <p className="font-medium text-muted-foreground">Non communiqué</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => router.push('/dashboard/reports')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Mes signalements
              </Button>
              <Button onClick={() => { setSubmittedReport(null); setGps(null); setImages([]); }}>
                <Camera className="mr-2 h-4 w-4" /> Nouveau signalement
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <RoleGuard dashboard="SHARED">
    <div className="space-y-6 p-4 lg:p-6">
      <DashboardPageHeader title="Nouveau signalement" description="Décrivez le problème urbain à signaler" icon={Camera} />

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setValue('category', v); }}>
              <SelectTrigger className="w-full" aria-invalid={!!errors.category}><SelectValue placeholder="Choisissez une catégorie" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="flex items-center gap-2"><span>{c.icon}</span> {c.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Titre du signalement</Label>
            <div className="relative">
              <Type className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="title" className="pl-9" placeholder="Ex: Lampadaire en panne" {...register('title')} aria-invalid={!!errors.title} />
            </div>
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Localisation</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="location" className="pl-9" placeholder="Adresse ou position GPS" {...register('location')} aria-invalid={!!errors.location} />
              </div>
              <Button type="button" variant="outline" onClick={detectGps}>
                <MapPin className="mr-2 h-4 w-4" /> GPS
              </Button>
            </div>
            {gps ? (
              <p className="text-xs text-success">Coordonnées enregistrées avec le signalement : {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sans coordonnées GPS, le signalement ne sera pas affiché sur la carte.</p>
            )}
            {errors.location && <p className="text-xs text-destructive">{errors.location.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Niveau d&rsquo;urgence</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => { setPriority(p.value); setValue('priority', p.value); }}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${priority === p.value ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                >
                  <span className={`text-sm font-semibold ${p.color}`}>{p.label}</span>
                  <span className="text-[10px] text-muted-foreground">{p.desc}</span>
                </button>
              ))}
            </div>
            <input type="hidden" {...register('priority')} />
            {errors.priority && <p className="text-xs text-destructive">{errors.priority.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={4} placeholder="Décrivez le problème en détail..." {...register('description')} aria-invalid={!!errors.description} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="photos">Photos (facultatif)</Label>
            <div className="flex flex-wrap gap-3">
              {images.map((img, idx) => (
                <div key={img.preview} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={`Aperçu de la photo ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Retirer la photo ${idx + 1}`}
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {images.length < MAX_ATTACHMENTS && (
                <label htmlFor="photos" className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-muted">
                  <ImagePlus className="h-5 w-5" /> Ajouter
                </label>
              )}
            </div>
            <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={onPickImages} />
            <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP, 5 Mo maximum, {MAX_ATTACHMENTS} photos au plus. Les photos sont privées : seuls vous et le personnel autorisé peuvent les voir.</p>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Envoi...
                </span>
              ) : (
                <span className="flex items-center gap-2"><Send className="h-4 w-4" /> Envoyer le signalement</span>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
    </RoleGuard>
  );
}
