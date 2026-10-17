'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  /** `dialog` = centred; `sheet` = slides up from the bottom on mobile, centred from sm up. */
  variant?: 'dialog' | 'sheet';
  className?: string;
  children?: React.ReactNode;
};

export function Modal({ open, onClose, title, footer, variant = 'dialog', className, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const sheet = variant === 'sheet';

  return createPortal(
    <div className={cn('fixed inset-0 z-[90] flex justify-center', sheet ? 'items-end sm:items-center' : 'items-center p-4')}>
      <div className="absolute inset-0 bg-primary/60 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col bg-surface font-brand text-primary',
          sheet ? 'max-w-lg border-t border-line pb-[env(safe-area-inset-bottom)] sm:border' : 'max-w-md border border-line',
          className
        )}
      >
        {sheet && <div className="mx-auto mt-2.5 h-1 w-10 rounded-pill bg-line sm:hidden" />}
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          {title ? <h2 className="font-brand text-heading-lg uppercase">{title}</h2> : <span />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 inline-flex h-9 w-9 items-center justify-center text-muted hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 text-body">{children}</div>
        {footer && <div className="flex gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
