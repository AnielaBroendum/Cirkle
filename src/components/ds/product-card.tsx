import Link from 'next/link';
import { Heart } from 'lucide-react';
import { formatDKK } from '@/lib/utils';
import { FROM_LABEL } from '@/lib/pricing';
import { cn } from './cn';
import { Badge, type BadgeTone } from './badge';

type ProductCardProps = {
  name: string;
  /** Price in øre; the lowest one when variants differ (see priceFrom). */
  price: number;
  /** Shows "From [price]": the product's variants cost different amounts. */
  priceFrom?: boolean;
  brand?: string | null;
  imageUrl?: string | null;
  href?: string;
  badge?: { label: React.ReactNode; tone?: BadgeTone };
  saved?: boolean;
  /** Renders a save (heart) button when provided. */
  onToggleSave?: () => void;
  className?: string;
};

export function ProductCard({ name, price, priceFrom, brand, imageUrl, href, badge, saved, onToggleSave, className }: ProductCardProps) {
  const body = (
    <>
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-flaym-gradient">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        )}
        {badge && (
          <Badge tone={badge.tone ?? 'dark'} className="absolute left-2.5 top-2.5">
            {badge.label}
          </Badge>
        )}
      </div>
      <div className="space-y-1 p-3">
        {brand && <p className="truncate text-label uppercase text-slate">{brand}</p>}
        <p className="line-clamp-2 text-body text-primary">{name}</p>
        <p className="text-body font-medium text-primary">{priceFrom ? `${FROM_LABEL} ${formatDKK(price)}` : formatDKK(price)}</p>
      </div>
    </>
  );

  return (
    <div className={cn('group relative border border-line bg-surface font-brand', className)}>
      {href ? (
        <Link href={href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
      {onToggleSave && (
        <button
          type="button"
          onClick={onToggleSave}
          aria-label={saved ? 'Remove from saved' : 'Save'}
          aria-pressed={saved}
          className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center bg-surface text-primary"
        >
          <Heart className={cn('h-4 w-4', saved && 'fill-accent text-accent')} />
        </button>
      )}
    </div>
  );
}
