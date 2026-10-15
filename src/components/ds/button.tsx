import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary/90',
  accent: 'bg-accent text-on-primary hover:bg-accent/90',
  secondary: 'border border-line bg-surface text-primary hover:border-primary',
  ghost: 'text-primary hover:bg-surface-muted',
};

// md = Figma (44px tall, 20px side padding, 14px medium).
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-caption gap-1.5',
  md: 'h-11 px-5 text-body gap-2',
  lg: 'h-14 px-6 text-body gap-2',
};

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

/** Button styling for non-button elements, e.g. `<Link className={buttonClasses({ variant: 'accent' })}>`. */
export function buttonClasses({ variant = 'primary', size = 'md', fullWidth, className }: ButtonClassOptions = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-control font-brand font-medium whitespace-nowrap transition-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:pointer-events-none disabled:opacity-40',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<ButtonClassOptions, 'className'> & {
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, loading, leftIcon, rightIcon, className, children, disabled, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
