'use client';

import { useSyncExternalStore } from 'react';

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
  /** Display only, in øre. The API recomputes the real price. */
  priceOre: number;
  image: string | null;
  size: string | null;
  color: string | null;
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
