'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Apple, CreditCard, Loader2, Minus, Plus, Smartphone } from 'lucide-react';
import { cn } from '@/components/ds';
import { formatDKK } from '@/lib/utils';

// Shared pieces for the Figma 05 Basket / 06 Checkout / 14 Order placed screens.

/** Flaym flame mark (Figma "flame", 12×17). */
export function FlameIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/flame.svg" alt="" width={12} height={17} className={cn('inline-block shrink-0', className)} />;
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <header className="grid h-[52px] grid-cols-[1fr_auto_1fr] items-end px-5 pb-1">
      <div>
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Back" className="text-[16px] leading-none text-on-primary">
            ←
          </button>
        )}
      </div>
      <h1 className="font-brand text-title font-normal uppercase leading-none tracking-[0.4px] text-on-primary">{title}</h1>
      <div className="flex justify-end">{right}</div>
    </header>
  );
}

export function DarkCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('bg-surface-dark p-4', className)}>{children}</div>;
}

export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn('text-label uppercase text-smoke', className)}>{children}</p>;
}

/** Product thumbnail; falls back to the Flaym gradient like the Figma placeholders. */
export function Thumb({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden bg-flaym-gradient', className)}>
      {src && <Image src={src} alt={alt} fill className="object-cover" sizes="80px" />}
    </div>
  );
}

const fieldClasses =
  'w-full border-b border-line-dark bg-transparent py-1.5 text-body text-on-primary placeholder:text-smoke focus:border-accent focus:outline-none';

type Shipping = { name: string; address: string; postalCode: string; city: string };

/** Figma "Deliver to" card, editable (the API needs these fields). */
export function DeliverToCard({ value, onChange }: { value: Shipping; onChange: (next: Shipping) => void }) {
  const set = (key: keyof Shipping) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value });
  return (
    <DarkCard>
      <Eyebrow>Deliver to</Eyebrow>
      <div className="mt-2 space-y-1">
        <input required autoComplete="name" aria-label="Full name" placeholder="Full name" value={value.name} onChange={set('name')} className={fieldClasses} />
        <input required autoComplete="street-address" aria-label="Address" placeholder="Address" value={value.address} onChange={set('address')} className={cn(fieldClasses, 'text-body-sm text-ash')} />
        <div className="flex gap-3">
          <input required autoComplete="postal-code" aria-label="Postal code" placeholder="Postal code" value={value.postalCode} onChange={set('postalCode')} className={cn(fieldClasses, 'w-1/3 text-body-sm text-ash')} />
          <input required autoComplete="address-level2" aria-label="City" placeholder="City" value={value.city} onChange={set('city')} className={cn(fieldClasses, 'flex-1 text-body-sm text-ash')} />
        </div>
      </div>
    </DarkCard>
  );
}

export function DeliveryCard({ brands }: { brands: { name: string; feeOre: number }[] }) {
  return (
    <DarkCard>
      <Eyebrow>Delivery</Eyebrow>
      <ul className="mt-3 space-y-3">
        {brands.map((b) => (
          <li key={b.name} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body text-on-primary">{b.name}</p>
              <p className="text-caption text-smoke">Ships from the brand · 2–3 days</p>
            </div>
            <span className="text-body text-on-primary">{formatDKK(b.feeOre)}</span>
          </li>
        ))}
      </ul>
    </DarkCard>
  );
}

export type PaymentMethod = 'mobilepay' | 'applepay' | 'card';

const METHODS: { id: PaymentMethod; label: string; icon: typeof CreditCard }[] = [
  { id: 'mobilepay', label: 'MobilePay', icon: Smartphone },
  { id: 'applepay', label: 'Apple Pay', icon: Apple },
  { id: 'card', label: 'Card', icon: CreditCard },
];

/** Figma "Pay with". Mock only: the choice is not sent anywhere. */
export function PaymentPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <fieldset>
      <legend className="text-label uppercase text-smoke">Pay with</legend>
      <div className="mt-3 space-y-4">
        {METHODS.map((m) => {
          const on = value === m.id;
          return (
            <label key={m.id} className={cn('flex h-14 cursor-pointer items-center gap-3.5 bg-surface-dark px-4', on && 'outline outline-1 outline-accent/40')}>
              <input type="radio" name="payment" value={m.id} checked={on} onChange={() => onChange(m.id)} className="sr-only" />
              <span className="grid h-6 w-9 place-items-center rounded bg-on-primary/10 text-on-primary">
                <m.icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-body text-on-primary">{m.label}</span>
              <span className={cn('h-[18px] w-[18px] rounded-pill', on ? 'border-[5px] border-accent' : 'border-[1.5px] border-char')} aria-hidden />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Redeem Flayms (points): 1 Flaym = 1 kr. Same stepper rules as before. */
export function FlaymsCard({
  balance,
  value,
  max,
  onChange,
}: {
  balance: number;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <DarkCard>
      <div className="flex items-center justify-between">
        <Eyebrow>Use Flayms</Eyebrow>
        <span className="flex items-center gap-1.5 text-caption text-ash">
          <FlameIcon className="h-3 w-auto" /> {balance} available
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          aria-label="Use fewer Flayms"
          onClick={() => onChange(Math.max(0, value - 10))}
          disabled={value <= 0}
          className="grid h-9 w-9 place-items-center border border-char text-on-primary disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <p className="flex-1 text-center text-body text-on-primary">
          {value} <span className="text-smoke">Flayms</span>
          {value > 0 && <span className="text-accent"> · −{formatDKK(value * 100)}</span>}
        </p>
        <button
          type="button"
          aria-label="Use more Flayms"
          onClick={() => onChange(Math.min(max, value + 10))}
          disabled={value >= max}
          className="grid h-9 w-9 place-items-center border border-char text-on-primary disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-caption text-smoke">1 Flaym = 1 kr off</p>
    </DarkCard>
  );
}

export function SummaryCard({ rows, totalOre }: { rows: { label: string; valueOre: number; accent?: boolean }[]; totalOre: number }) {
  return (
    <DarkCard className="space-y-3 text-body">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-3">
          <span className={r.accent ? 'text-accent' : 'text-smoke'}>{r.label}</span>
          <span className={r.accent ? 'text-accent' : 'text-on-primary'}>
            {r.valueOre < 0 ? `−${formatDKK(-r.valueOre)}` : formatDKK(r.valueOre)}
          </span>
        </div>
      ))}
      <div className="flex justify-between gap-3 font-medium text-on-primary">
        <span>Total</span>
        <span>{formatDKK(totalOre)}</span>
      </div>
    </DarkCard>
  );
}

/** Fixed bottom action (Figma 52px Flaym-orange button). */
export function BottomAction({
  note,
  children,
  loading,
  disabled,
  type = 'button',
  onClick,
  href,
}: {
  note?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    'flex h-[52px] w-full items-center justify-center gap-2 bg-accent text-body-lg font-medium text-on-primary transition-colors hover:bg-accent/90 disabled:opacity-50';
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-canvas-dark pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-lg px-5 pb-4 pt-3">
        {note && <p className="mb-3 text-center text-label tracking-normal text-smoke">{note}</p>}
        {href ? (
          <Link href={href} className={cls}>
            {children}
          </Link>
        ) : (
          <button type={type} onClick={onClick} disabled={disabled || loading} className={cls}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
          </button>
        )}
      </div>
    </div>
  );
}

export type PlacedItem = { name: string; brand: string; size?: string | null; priceOre: number; image: string | null };

/** Figma 14 Order placed. */
export function OrderPlaced({
  items,
  supporting,
  orderHref,
  note,
}: {
  items: PlacedItem[];
  supporting?: string | null;
  orderHref: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="px-5 pb-28 pt-[117px] text-center">
      <div className="mx-auto grid h-[88px] w-[88px] place-items-center rounded-pill border-[3px] border-accent text-[40px] leading-none text-accent">
        ✓
      </div>
      <h1 className="mt-6 font-brand text-[24px] font-normal uppercase tracking-[0.5px] text-on-primary">Order placed</h1>
      <p className="mt-4 text-body text-ash">{items.length > 1 ? 'The brands have your order' : 'The brand has your order'}</p>
      {supporting && (
        <p className="mt-5 flex items-center justify-center gap-2 text-body-sm text-on-primary">
          <FlameIcon /> Supporting <span className="text-accent">{supporting}</span>
        </p>
      )}
      <ul className="mt-6 space-y-2 text-left">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-3.5 bg-surface-dark p-4">
            <Thumb src={item.image} alt={item.name} className="h-[70px] w-14" />
            <div className="min-w-0">
              <p className="truncate text-body text-on-primary">{item.name}</p>
              <p className="truncate text-caption text-smoke">
                {[item.brand, item.size && `Size ${item.size}`, formatDKK(item.priceOre)].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {note && <div className="mt-4 text-caption text-ash">{note}</div>}
      <BottomAction href={orderHref}>Follow your order</BottomAction>
    </div>
  );
}
