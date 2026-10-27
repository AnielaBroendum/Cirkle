import { cn } from './cn';

export type BadgeTone = 'accent' | 'neutral' | 'success' | 'warning' | 'outline' | 'dark';

// Figma pills: New = accent, Shipped = neutral, Delivered = success, Pending = warning.
const TONES: Record<BadgeTone, string> = {
  accent: 'bg-accent-subtle text-accent-strong',
  neutral: 'bg-surface-muted text-primary',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  outline: 'border border-line text-slate',
  dark: 'bg-primary text-on-primary',
};

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone };

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[23px] items-center whitespace-nowrap rounded-pill px-2.5 font-brand text-caption font-medium',
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}

/**
 * Maps every status value in the database (orders, samples, sample requests,
 * swaps, partnerships, commissions, deposit transactions) to a pill tone.
 * Figma has no danger colour, so negative outcomes use the `outline` tone.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  // waiting on someone
  pending: 'warning',
  requested: 'warning',
  invited: 'warning',
  paused: 'warning',
  // new / just accepted
  confirmed: 'accent',
  approved: 'accent',
  // in progress
  packed: 'neutral',
  shipped: 'neutral',
  return_shipped: 'neutral',
  return_received: 'neutral',
  new_shipped: 'neutral',
  inactive: 'neutral',
  returned: 'neutral',
  swap_out: 'neutral',
  swap_in: 'neutral',
  deposit_paid: 'neutral',
  // done / good
  delivered: 'success',
  received: 'success',
  completed: 'success',
  active: 'success',
  paid: 'success',
  inspected_ok: 'success',
  deposit_refunded: 'success',
  // negative
  cancelled: 'outline',
  rejected: 'outline',
  declined: 'outline',
  damaged: 'outline',
  inspected_damaged: 'outline',
  reversed: 'outline',
  deposit_forfeited: 'outline',
};

export function statusTone(status: string): BadgeTone {
  return STATUS_TONES[status] ?? 'neutral';
}

function statusLabel(status: string) {
  const text = status.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type StatusPillProps = Omit<BadgeProps, 'tone' | 'children'> & {
  status: string;
  /** Override the default label ("return_shipped" → "Return shipped"). */
  label?: React.ReactNode;
};

export function StatusPill({ status, label, ...props }: StatusPillProps) {
  return (
    <Badge tone={statusTone(status)} {...props}>
      {label ?? statusLabel(status)}
    </Badge>
  );
}
