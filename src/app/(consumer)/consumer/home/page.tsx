'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Search, SlidersHorizontal, Plus, Check, Coins, ChevronRight } from 'lucide-react';

type ProductRow = {
  id: string;
  name: string;
  price_dkk: number;
  images: string[] | null;
  category: string | null;
  brand_profiles: { name: string } | null;
};

// Espresso gradient fallbacks for products without photography.
const GRADIENTS = [
  'linear-gradient(160deg,#E0915C 0%,#7a3f1f 70%,#2a1308 100%)',
  'linear-gradient(160deg,#C9A06A 0%,#6f4c30 65%,#241509 100%)',
  'linear-gradient(160deg,#b97e63 0%,#5e3320 70%,#1c0f08 100%)',
  'linear-gradient(160deg,#caa57e 0%,#7a5c44 60%,#241509 100%)',
  'linear-gradient(160deg,#d8a03a 0%,#7a531a 70%,#241509 100%)',
  'linear-gradient(160deg,#a98b86 0%,#5b3b3b 70%,#1c0f0d 100%)',
];

export default function ConsumerHomePage() {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<number | null>(null);
  const [activeCat, setActiveCat] = useState('All');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('products')
      .select('id, name, price_dkk, images, category, brand_profiles (name)')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }: { data: ProductRow[] | null }) => {
        setProducts(data ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .rpc('get_points_balance', { p_user_id: user.id })
      .then(({ data }: { data: number | null }) => setPoints(data ?? 0));
  }, [user]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return ['All', ...Array.from(set)];
  }, [products]);

  const visible = useMemo(() => {
    return products.filter((p) => {
      const catOk = activeCat === 'All' || p.category === activeCat;
      const q = query.trim().toLowerCase();
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.brand_profiles?.name ?? '').toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [products, activeCat, query]);

  async function handleSave(e: React.MouseEvent, productId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (saved.has(productId)) return;
    setSaved((prev) => new Set(prev).add(productId));
    try {
      await fetch('/api/saved-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
    } catch {
      /* optimistic — ignore network errors in the prototype flow */
    }
  }

  const firstName = (profile?.name ?? '').split(' ')[0];

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        {firstName && (
          <p className="text-sm text-espresso-muted">Welcome back, {firstName}</p>
        )}
        <h1 className="text-[34px] leading-tight text-espresso-cream">
          For <em className="italic">you</em>
        </h1>
      </div>

      {/* Points banner */}
      <Link
        href="/consumer/profile"
        className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-espresso-line p-4 no-underline"
        style={{ background: 'linear-gradient(115deg,#3a2417,#1f120a)' }}
      >
        <span
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(216,160,58,0.4),transparent 70%)' }}
        />
        <span className="relative">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1.4px] text-terracotta">
            <Coins className="h-3.5 w-3.5" /> Cirkle Points
          </span>
          <span className="mt-1 block font-display text-2xl text-espresso-cream">
            {points ?? '—'}
          </span>
        </span>
        <span className="relative flex items-center gap-1 text-xs text-espresso-cream/80">
          View rewards <ChevronRight className="h-4 w-4" />
        </span>
      </Link>

      {/* Search */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-espresso-line bg-espresso-surface px-4 py-3">
        <Search className="h-[18px] w-[18px] text-espresso-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search makers, pieces…"
          className="flex-1 bg-transparent text-sm text-espresso-cream placeholder:text-espresso-muted-2 focus:outline-none"
        />
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-terracotta text-espresso-bg">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
      </div>

      {/* Category tabs */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold capitalize transition ${
              activeCat === cat
                ? 'border-espresso-cream bg-espresso-cream text-espresso-bg'
                : 'border-espresso-line text-espresso-muted'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-espresso-surface" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-espresso-muted">
          No pieces here yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {visible.map((p, i) => {
            const img = p.images?.[0];
            const isSaved = saved.has(p.id);
            return (
              <Link
                key={p.id}
                href={`/d/${p.id}`}
                className="group relative block overflow-hidden rounded-2xl no-underline active:scale-[0.98]"
              >
                {/* Image / gradient */}
                <div
                  className="relative aspect-[3/4]"
                  style={img ? undefined : { background: GRADIENTS[i % GRADIENTS.length] }}
                >
                  {img && (
                    <Image src={img} alt={p.name} fill className="object-cover" sizes="50vw" />
                  )}
                  {/* + save */}
                  <button
                    onClick={(e) => handleSave(e, p.id)}
                    aria-label="Save"
                    className={`absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition ${
                      isSaved
                        ? 'border-terracotta bg-terracotta text-espresso-bg'
                        : 'border-white/20 bg-espresso-bg/55 text-white'
                    }`}
                  >
                    {isSaved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                  {/* Overlay caption */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-espresso-bg/85 to-transparent px-3 pb-3 pt-8">
                    <p className="text-[9px] font-bold uppercase tracking-[1.4px] text-terracotta">
                      {p.brand_profiles?.name}
                    </p>
                    <p className="mt-0.5 truncate font-display text-[15px] leading-tight text-espresso-cream">
                      {p.name}
                    </p>
                    <p className="mt-1 text-[12.5px] font-semibold text-espresso-cream">
                      {formatDKK(p.price_dkk)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
