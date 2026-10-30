'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase';
import { priceRange, type VariantPrice } from '@/lib/pricing';

// Client-side basket (Figma 05). Lives in localStorage so it survives the
// signup redirect. Checkout still goes through POST /api/checkout, once per
// item, so prices, stock, points and attribution are all decided server-side.

export type BasketItem = {
  /** Unique per product + size + colour. */
  key: string;
  productId: string;
  name: string;
  brandId: string;
  brandName: string;
  /** Display only, in øre; refreshed by useBasketPrices. The API recomputes the real price. */
  priceOre: number;
  image: string | null;
  size: string | null;
  color: string | null;
  /** Where the shopper found it, for display ("Size M · [Store]"). Attribution itself is server-side. */
  foundVia?: { type: 'retailer' | 'peer'; name: string };
};

const STORAGE_KEY = 'flaym-basket';
const EMPTY: BasketItem[] = [];
const listeners = new Set<() => void>();
let cache: BasketItem[] | null = null;

function read(): BasketItem[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as BasketItem[]) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(items: BasketItem[]) {
  cache = items;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage blocked (private mode): the basket still works for this page view.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function basketKey(productId: string, size: string | null, color: string | null) {
  return [productId, size ?? '', color ?? ''].join('|');
}

/** Adds an item; the same product + size + colour is only kept once. */
export function addToBasket(item: Omit<BasketItem, 'key'>) {
  const key = basketKey(item.productId, item.size, item.color);
  const items = read().filter((i) => i.key !== key);
  write([...items, { ...item, key }]);
}

export function removeFromBasket(key: string) {
  write(read().filter((i) => i.key !== key));
}

export function clearBasket(keys?: string[]) {
  write(keys ? read().filter((i) => !keys.includes(i.key)) : EMPTY);
}

export function useBasket(): BasketItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/**
 * Re-reads each item's current price (variant price, else the product's) so the
 * basket doesn't show what it cost when it was added. Checkout still prices
 * every order on the server.
 */
export async function refreshBasketPrices() {
  const items = read();
  const ids = Array.from(new Set(items.map((i) => i.productId)));
  if (ids.length === 0) return;
  const { data } = await createClient()
    .from('products')
    .select('id, price_dkk, product_variants(size, color, price_dkk)')
    .in('id', ids);
  if (!data) return;
  const products = new Map(
    (data as { id: string; price_dkk: number; product_variants: VariantPrice[] }[]).map((p) => [p.id, p])
  );
  // Read again: the basket may have changed while the query ran.
  let changed = false;
  const next = read().map((item) => {
    const p = products.get(item.productId);
    if (!p) return item; // inactive or gone: checkout will say so
    const priceOre = priceRange(p.price_dkk, p.product_variants ?? [], item.size, item.color).min;
    if (priceOre === item.priceOre) return item;
    changed = true;
    return { ...item, priceOre };
  });
  if (changed) write(next);
}

/** Refreshes basket prices once when the page mounts. */
export function useBasketPrices() {
  useEffect(() => {
    refreshBasketPrices().catch(() => {});
  }, []);
}

// Same flat delivery fee the checkout has always shown, now per brand.
export const DELIVERY_FEE_ORE = 4900;

export function groupByBrand(items: BasketItem[]) {
  const groups = new Map<string, { brandName: string; items: BasketItem[] }>();
  for (const item of items) {
    const g = groups.get(item.brandId) ?? { brandName: item.brandName, items: [] };
    g.items.push(item);
    groups.set(item.brandId, g);
  }
  return Array.from(groups.values());
}
