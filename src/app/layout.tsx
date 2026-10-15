import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces, IBM_Plex_Mono } from 'next/font/google';
import { AuthProvider } from '@/components/providers/auth-provider';
import { ToastProvider } from '@/components/ui/toast';
import ServiceWorkerRegister from '@/components/pwa/sw-register';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz'],
});
// Flaym redesign font (used via `font-brand`).
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cirkle — Discover Fashion Everywhere',
  description: 'Scan, discover, and buy fashion from your favourite brands — in stores and from friends.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cirkle',
  },
};

export const viewport: Viewport = {
  themeColor: '#1A0F08',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased bg-espresso-bg text-espresso-cream">
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
          <ServiceWorkerRegister />
        </AuthProvider>
      </body>
    </html>
  );
}
