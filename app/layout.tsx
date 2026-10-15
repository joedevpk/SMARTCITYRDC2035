import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/components/providers';

// Polices locales (variables, sous-ensemble latin = français inclus) : aucune requête vers Google Fonts au build.
const inter = localFont({
  src: './fonts/Inter-latin-variable.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

const spaceGrotesk = localFont({
  src: './fonts/SpaceGrotesk-latin-variable.woff2',
  variable: '--font-display',
  display: 'swap',
  weight: '300 700',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'SMART CITY RDC 2035 — Plateforme Nationale Intelligente',
  description:
    "Plateforme nationale intelligente de gestion urbaine du Gouvernement de la République Démocratique du Congo. Connecter Gouvernement, Ministères, Provinces, Communes et Citoyens.",
  keywords: ['Smart City', 'RDC', 'Congo', 'Gouvernement', 'Gestion urbaine', 'Smart Nation'],
  authors: [{ name: 'Gouvernement de la RDC' }],
  openGraph: {
    title: 'SMART CITY RDC 2035',
    description: 'Plateforme nationale intelligente de gestion urbaine',
    type: 'website',
  },
  metadataBase: new URL('https://smartcity-rdc.cd'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
