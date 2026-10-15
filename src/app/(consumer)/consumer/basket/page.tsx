'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonClasses } from '@/components/ds';
import { formatDKK } from '@/lib/utils';
import { DELIVERY_FEE_ORE, groupByBrand, removeFromBasket, useBasket, type BasketItem } from '@/components/consumer/basket-store';
import { BottomAction, Eyebrow, ScreenHeader, SummaryCard, Thumb } from '@/components/consumer/checkout-parts';

function itemMeta(item: BasketItem) {
  const found =
    item.foundVia && (item.foundVia.type === 'retailer' ? item.foundVia.name : `Passed on by ${item.foundVia.name}`);
  return [item.size && `Size ${item.size}`, item.color, found].filter(Boolean).join(' · ');
}

export default function BasketPage() {
  const router = useRouter();
  const items = useBasket();
  // localStorage is only readable after mount; avoid flashing the empty state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const groups = groupByBrand(items);
  const subtotal = items.reduce((sum, i) => sum + i.priceOre, 0);
  const delivery = groups.length * DELIVERY_FEE_ORE;

  return (
    <div className="pb-48">
      <ScreenHeader
        title="Basket"
        onBack={() => router.back()}
        right={mounted && items.length > 0 ? <span className="text-[13px] leading-none text-line">{items.length} {items.length === 1 ? 'item' : 'items'}</span> : null}
      />

      {!mounted ? (
        <div className="space-y-3.5 px-5 pt-6" aria-busy>
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3.5">
              <div className="h-20 w-16 animate-pulse bg-surface-dark" />
              <div className="h-4 w-40 animate-pulse bg-surface-dark" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center px-5 pt-24 text-center">
          <p className="font-brand text-[18px] uppercase tracking-[0.4px] text-on-primary">Your basket is empty</p>
          <p className="mt-3 max-w-[260px] text-body text-line">Scan a Flaym tag in a store, or open something you saved.</p>
          <div className="mt-8 flex w-full max-w-[280px] flex-col gap-2.5">
            <button type="button" onClick={() => router.push('/consumer/home')} className={buttonClasses({ variant: 'accent', fullWidth: true })}>
              Scan a tag
            </button>
            <button
              type="button"
              onClick={() => router.push('/consumer/saved')}
              className={buttonClasses({ variant: 'ghost', fullWidth: true, className: 'border border-muted text-on-primary hover:bg-surface-dark' })}
            >
              Go to saved
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="px-5 pt-5">
            {groups.map((group, gi) => (
              <section key={group.brandName} className={gi > 0 ? 'mt-3.5 border-t border-line-dark pt-3.5' : ''}>
                <Eyebrow>{group.brandName} · ships separately</Eyebrow>
                <ul className="mt-3.5 space-y-3.5">
                  {group.items.map((item) => (
                    <li key={item.key} className="flex items-center gap-3.5">
                      <Thumb src={item.image} alt={item.name} className="h-20 w-16" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body text-on-primary">{item.name}</p>
                        <p className="truncate text-caption text-muted">{itemMeta(item)}</p>
                        <button
                          type="button"
                          onClick={() => removeFromBasket(item.key)}
                          className="mt-1 text-caption text-muted underline-offset-2 hover:text-on-primary hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <span className="text-body text-on-primary">{formatDKK(item.priceOre)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="fixed inset-x-0 bottom-[84px] z-30 mx-auto max-w-lg px-5">
            <SummaryCard
              rows={[
                { label: 'Subtotal', valueOre: subtotal },
                { label: `Delivery (${groups.length} ${groups.length === 1 ? 'brand' : 'brands'})`, valueOre: delivery },
              ]}
              totalOre={subtotal + delivery}
            />
          </div>
          <BottomAction href="/consumer/checkout">Go to checkout</BottomAction>
        </>
      )}
    </div>
  );
}
