'use client';

import { useEffect, useState } from 'react';

// Figma "App / 16": a lock-screen message at each order step. Shown on the
// tracking screen until the shopper turns messages on (or blocks them).
// Needs the service worker (production builds) and NEXT_PUBLIC_VAPID_PUBLIC_KEY.
// On iPhone, web push only works once Flaym is added to the home screen.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = 'hidden' | 'ask' | 'working' | 'on' | 'error';

export default function PushPrompt() {
  const [state, setState] = useState<State>('hidden');

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission === 'denied') return;
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) return; // no service worker (development build)
      const existing = await reg.pushManager.getSubscription();
      setState(existing && Notification.permission === 'granted' ? 'hidden' : 'ask');
    });
  }, []);

  async function turnOn() {
    setState('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('hidden');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
        }));
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setState(res.ok ? 'on' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'hidden') return null;

  return (
    <div className="mt-6 flex items-center justify-between gap-4 border border-line-dark px-4 py-3.5">
      <p className="text-body-sm text-ash">
        {state === 'on'
          ? "Messages are on. You'll hear from us at each step."
          : state === 'error'
            ? 'Could not turn messages on. Try again later.'
            : 'Get a message at each step.'}
      </p>
      {(state === 'ask' || state === 'working') && (
        <button
          type="button"
          onClick={turnOn}
          disabled={state === 'working'}
          className="shrink-0 bg-accent px-3.5 py-2 text-button uppercase text-on-primary disabled:opacity-60"
        >
          Turn on
        </button>
      )}
    </div>
  );
}
