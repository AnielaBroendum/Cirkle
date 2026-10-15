'use client';

import { forwardRef, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from './cn';

/* ── Field: label + control + hint/error ─────────────────────────────── */

type FieldProps = {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

// Figma "Input label": 11px uppercase Char, 6px above the control.
export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5 font-brand', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-label uppercase text-muted">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-caption text-accent-strong">{error}</p>
      ) : hint ? (
        <p className="text-caption text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* ── Shared control styling ──────────────────────────────────────────── */

// Figma "input": white surface, 1px Ash border, 14px Obsidian text, square.
// No danger colour in Figma — errors use the accent tones.
export function controlClasses(invalid?: boolean, className?: string) {
  return cn(
    'w-full rounded-control border bg-surface font-brand text-body text-primary placeholder:text-muted',
    'outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60',
    invalid ? 'border-accent focus:border-accent' : 'border-line',
    className
  );
}

type ControlExtras = { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & ControlExtras>(
  function Input({ invalid, className, ...props }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={controlClasses(invalid, cn('h-11 px-3.5', className))}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & ControlExtras>(
  function Textarea({ invalid, className, rows = 4, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={controlClasses(invalid, cn('min-h-[88px] px-3.5 py-3 resize-y', className))}
        {...props}
      />
    );
  }
);

// Native select so existing onChange/value wiring keeps working unchanged.
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & ControlExtras>(
  function Select({ invalid, className, children, ...props }, ref) {
    return (
      <div className={cn('relative', className)}>
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={controlClasses(invalid, 'h-11 appearance-none pl-3.5 pr-10')}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    );
  }
);

/* ── Checkbox ────────────────────────────────────────────────────────── */

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: React.ReactNode;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn('inline-flex cursor-pointer items-center gap-2.5 font-brand text-body text-primary', className)}>
      <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer h-full w-full cursor-pointer appearance-none rounded-control border border-line bg-surface transition-colors checked:border-primary checked:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
          {...props}
        />
        <Check className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-on-primary opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      {label}
    </label>
  );
});

/* ── Toggle (switch) ─────────────────────────────────────────────────── */

type ToggleProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: React.ReactNode;
};

export function Toggle({ checked, onCheckedChange, label, className, disabled, ...props }: ToggleProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-brand text-body text-primary', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill border transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40',
          checked ? 'border-primary bg-primary' : 'border-line bg-surface-muted'
        )}
        {...props}
      >
        <span
          className={cn(
            'inline-block h-[18px] w-[18px] rounded-pill bg-surface transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
          )}
        />
      </button>
      {label}
    </span>
  );
}
