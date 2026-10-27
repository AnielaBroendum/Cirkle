'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (sessionStorage.getItem('pwa-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem('pwa-dismissed', '1');
  }

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-sm font-brand">
      <div className="flex items-center gap-3 border border-line-dark bg-surface-dark p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center bg-accent text-on-primary">
          <Download className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body text-on-primary">Install Flaym</p>
          <p className="text-caption text-smoke">Scan faster from your home screen</p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="h-8 shrink-0 bg-accent px-3 text-caption font-medium text-on-primary hover:bg-accent/90"
        >
          Install
        </button>
        <button type="button" onClick={handleDismiss} aria-label="Dismiss" className="shrink-0 p-1 text-smoke hover:text-on-primary">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
