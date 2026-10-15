'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { translations, getInitialLanguage, type LanguageCode, type TranslationKey } from '@/lib/i18n';

interface I18nState {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: TranslationKey) => string;
}

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      lang: 'fr',
      setLang: (lang) => set({ lang }),
      t: (key) => {
        const lang = get().lang;
        return (translations[lang] as Record<string, string>)[key] ?? (translations.fr as Record<string, string>)[key] ?? key;
      },
    }),
    {
      name: 'rdc-lang',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : (undefined as unknown as Storage))),
      onRehydrateStorage: () => (state) => {
        if (state && typeof window !== 'undefined') {
          state.lang = getInitialLanguage();
        }
      },
    }
  )
);
