'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import { cn } from './cn';

// Same API as components/ui/toast.tsx, so pages can switch with an import change.
export type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastContextValue = { toast: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastType, typeof Check> = { success: Check, error: X, warning: AlertTriangle, info: Info };

// No danger colour in Figma: errors are obsidian with an accent icon.
const STYLES: Record<ToastType, { box: string; icon: string }> = {
  success: { box: 'bg-success-subtle text-success border-success/20', icon: '' },
  warning: { box: 'bg-warning-subtle text-warning border-warning/20', icon: '' },
  info: { box: 'bg-primary text-on-primary border-primary', icon: '' },
  error: { box: 'bg-primary text-on-primary border-primary', icon: 'text-accent' },
};

/** A single toast, for static use. */
export function Toast({ message, type = 'success', className }: { message: React.ReactNode; type?: ToastType; className?: string }) {
  const Icon = ICONS[type];
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-center gap-2.5 border px-4 py-3 font-brand text-body font-medium',
        STYLES[type].box,
        className
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', STYLES[type].icon)} />
      {message}
    </div>
  );
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: ToastType }[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} className="animate-toast-in" />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
