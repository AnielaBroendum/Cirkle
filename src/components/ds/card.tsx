import { cn } from './cn';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: 'light' | 'dark';
};

const PADDING = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-7' };

export function Card({ padding = 'md', tone = 'light', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-control border font-brand',
        tone === 'light' ? 'border-line bg-surface text-primary' : 'border-primary bg-primary text-on-primary',
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
