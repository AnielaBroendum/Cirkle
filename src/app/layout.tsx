import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import { AuthProvider } from '@/components/providers/auth-provider';
import { ToastProvider } from '@/components/ds';
import ServiceWorkerRegister from '@/components/pwa/sw-register';
import './globals.css';

// Flaym brand font (used via `font-brand`).
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Flaym — Scan it. Save it. Pass it on.',
  description: 'Scan, discover and buy fashion from your favourite brands, in stores and from friends.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Flaym',
  },
};

export const viewport: Viewport = {
  themeColor: '#2C2324',
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
    <html lang="en" className={plexMono.variable}>
      <body className="bg-canvas font-brand text-primary antialiased">
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
