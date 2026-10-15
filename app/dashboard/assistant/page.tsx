'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Bot, User, Lightbulb, FileText, MapPin, Calendar, Shield } from 'lucide-react';
import { DashboardPageHeader, Card } from '@/components/dashboard/dashboard-primitives';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RoleGuard } from '@/components/auth/role-guard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: { label: string; icon: typeof FileText; action: string }[];
}

const initialMessage: Message = {
  id: 'init',
  role: 'assistant',
  content: "Bonjour ! Je suis un assistant à réponses prédéfinies (ce n’est pas un modèle d’IA). Je peux vous orienter dans vos démarches administratives, vous aider à signaler un incident, rechercher un service ou répondre à vos questions. Comment puis-je vous aider aujourd'hui ?",
  suggestions: [
    { label: 'Signaler un incident', icon: FileText, action: 'Je veux signaler un incident' },
    { label: 'Démarches administratives', icon: Calendar, action: 'Quelles sont les démarches administratives ?' },
    { label: 'Trouver un service', icon: MapPin, action: 'Où trouver un service public ?' },
    { label: 'Sécurité', icon: Shield, action: 'Comment signaler un problème de sécurité ?' },
  ],
};

const knowledgeBase: { keywords: string[]; response: string; suggestions?: string[] }[] = [
  {
    keywords: ['signaler', 'incident', 'signalement', 'problème', 'panne'],
    response: "Pour signaler un incident, rendez-vous sur la page 'Signaler un incident'. Vous pouvez choisir la catégorie (déchet, lampadaire, fuite d'eau, etc.), ajouter une photo, activer la géolocalisation GPS et décrire le problème. Un numéro de dossier vous sera attribué pour suivre l'état du dossier.",
    suggestions: ['Aller au formulaire de signalement', 'Voir mes signalements'],
  },
  {
    keywords: ['démarche', 'administratif', 'document', 'passeport', 'acte', 'naissance'],
    response: "Les démarches administratives en ligne (actes d'état civil, passeport, listes électorales, permis de construire) ne sont pas encore raccordées à cette plateforme : renseignez-vous auprès des services concernés. Seul le signalement d'incidents est disponible aujourd'hui.",
    suggestions: ['Prendre un rendez-vous administratif', 'Voir la liste des services'],
  },
  {
    keywords: ['service', 'trouver', 'hôpital', 'commissariat', 'centre'],
    response: "Vous pouvez trouver les services publics proches de chez vous via la carte interactive. Elle affiche les hôpitaux, commissariats, casernes de pompiers, centres administratifs et zones à risque. Utilisez les filtres pour afficher uniquement les services qui vous intéressent.",
    suggestions: ['Ouvrir la carte interactive', 'Filtrer par catégorie'],
  },
  {
    keywords: ['sécurité', 'police', 'danger', 'urgence', 'attaque'],
    response: "En cas d'urgence, contactez immédiatement le 112 ou le commissariat le plus proche. Pour signaler un problème de sécurité non urgent, utilisez le formulaire de signalement en choisissant la catégorie 'Sécurité publique'. Votre signalement sera enregistré dans la plateforme ; sa transmission aux autorités dépend de leur raccordement.",
    suggestions: ['Signaler un problème de sécurité', 'Voir les commissariats sur la carte'],
  },
  {
    keywords: ['eau', 'coupure', 'fuite', 'inondation'],
    response: "Pour les problèmes d'eau (coupure, fuite, inondation), signalez-le via le formulaire de signalement en choisissant la catégorie 'Distribution d'eau'. Aucune notification automatique vers l'opérateur n'est active à ce stade : le signalement reste à traiter par les agents de la plateforme.",
    suggestions: ['Signaler un problème d\'eau', 'Voir mes signalements'],
  },
  {
    keywords: ['électricité', 'coupure', 'panne', 'courant'],
    response: "Pour une coupure d'électricité ou une panne, signalez-le via le formulaire en choisissant 'Électricité'. Aucune notification automatique vers l'opérateur n'est active à ce stade. Pour les urgences électriques (câble tombé), ne vous approchez pas et appelez immédiatement les services d'urgence.",
    suggestions: ['Signaler une coupure électrique', 'Voir la carte des incidents'],
  },
];

function findResponse(query: string): { content: string; suggestions?: string[] } {
  const lower = query.toLowerCase();
  for (const entry of knowledgeBase) {
    if (entry.keywords.some((k) => lower.includes(k))) {
      return { content: entry.response, suggestions: entry.suggestions };
    }
  }
  return {
    content: "Je n'ai pas trouvé de réponse précise à votre question. Vous pouvez essayer de reformuler, ou utiliser les raccourcis ci-dessous pour accéder aux services principaux. N'hésitez pas à contacter l'assistance pour une aide personnalisée.",
    suggestions: ['Signaler un incident', 'Voir mes signalements', 'Ouvrir la carte', 'Prendre un rendez-vous'],
  };
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const { content, suggestions } = findResponse(text);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        suggestions: suggestions?.map((s, i) => ({
          label: s,
          icon: [FileText, MapPin, Calendar, Shield, Lightbulb][i % 5],
          action: s,
        })),
      };
      setMessages((m) => [...m, assistantMsg]);
      setTyping(false);
    }, 800);
  };

  return (
    <RoleGuard dashboard="SHARED">
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4 lg:p-6">
      <DashboardPageHeader
        title="Assistant citoyen — réponses prédéfinies"
        description="Aide par mots-clés : aucun modèle d’IA n’est utilisé ici"
        icon={Sparkles}
      />

      <Card className="mt-4 flex flex-1 flex-col overflow-hidden p-0">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 lg:p-6">
          <AnimatePresence>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}
              >
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  m.role === 'assistant' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {m.role === 'assistant' ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </div>
                <div className={cn('max-w-[75%] rounded-2xl p-4', m.role === 'assistant' ? 'bg-muted/50' : 'bg-primary text-primary-foreground')}>
                  <p className="text-sm">{m.content}</p>
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.suggestions.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => sendMessage(s.action)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          <s.icon className="h-3 w-3" />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {typing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl bg-muted/50 p-4">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    className="h-2 w-2 rounded-full bg-primary"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question..."
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || typing}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
    </RoleGuard>
  );
}
