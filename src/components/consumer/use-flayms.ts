'use client';

import { useEffect, useState } from 'react';

export type FlaymsStats = {
  passedOn: number;
  lit: number;
  balance: number;
  byProduct: Record<string, { passedOn: number; lit: number }>;
  latest: {
    type: 'lit' | 'passed';
    productId: string;
    productName: string;
    image: string | null;
    friend: string | null;
    at: string;
  }[];
};

/** Reads GET /api/flayms (passed on / lit counts, feed, points balance). */
export function useFlayms() {
  const [stats, setStats] = useState<FlaymsStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/flayms')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: FlaymsStats) => active && setStats(data))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  return { stats, error };
}
