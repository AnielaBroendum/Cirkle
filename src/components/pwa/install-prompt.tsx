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
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto animate-in slide-in-from-bottom-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-cirkle-50 text-cirkle-600 flex-shrink-0">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Installer Cirkle</p>
          <p className="text-xs text-gray-500">Hurtigere adgang fra din hjemmeskaerm</p>
        </div>
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 bg-cirkle-600 text-white text-xs font-medium rounded-lg hover:bg-cirkle-700 transition flex-shrink-0"
        >
          Installer
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
