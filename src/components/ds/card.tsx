import { cn } from './cn';
import { flameSurface } from './surfaces';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** light/dark: old portal tones. portal: panel on a Portals v2 page. app: card on the consumer app's dark page. flame: highlight tile or banner (Figma v2). */
  tone?: 'light' | 'dark' | 'portal' | 'app' | 'flame';
};

const PADDING = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-7' };

const TONES = {
  light: 'border-line bg-surface text-primary',
  dark: 'border-primary bg-primary text-on-primary',
  portal: 'border-line-dark-subtle bg-obsidian text-flare',
  app: 'border-line-dark-subtle bg-surface-dark text-flare',
  // bg-origin-border: paint the gradient under the transparent border, so it doesn't repeat at the edges.
  flame: `border-transparent bg-origin-border ${flameSurface}`,
};

export function Card({ padding = 'md', tone = 'light', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-control border font-brand',
        TONES[tone],
        PADDING[padding],
        className
      )}
      {...props}
    />
  );
}

type CardHeaderProps = {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function CardHeader({ title, eyebrow, action, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-label uppercase text-slate">{eyebrow}</p>}
        <h3 className="font-brand text-heading-lg uppercase">{title}</h3>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
