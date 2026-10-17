import { cn } from './cn';

type AvatarProps = {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'square' | 'circle';
  className?: string;
};

const SIZES = { sm: 'h-8 w-8 text-label', md: 'h-10 w-10 text-caption', lg: 'h-14 w-14 text-body' };

function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function Avatar({ name, src, size = 'md', shape = 'square', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden bg-primary font-brand font-medium uppercase text-on-primary',
        shape === 'circle' ? 'rounded-pill' : 'rounded-control',
        SIZES[size],
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ''} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
