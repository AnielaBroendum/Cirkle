'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { buttonClasses, cn } from '@/components/ds';
import ProfileHeader from '@/components/consumer/profile-header';
import { Thumb } from '@/components/consumer/checkout-parts';
import { PrivacySettings } from '@/components/consumer/privacy-settings';

// Figma 09b "Profile – Owned". Points balance and history moved to the Flayms tab.

type OwnedRow = {
  id: string;
  order_items: {
    id: string;
    product_name: string;
    products: { images: string[] | null; brand_profiles: { name: string } | null } | null;
  }[];
};

type OwnedItem = { id: string; name: string; brand: string; image: string | null };

export default function ConsumerProfilePage() {
  const { user, profile, signOut } = useAuth();
  const [owned, setOwned] = useState<OwnedItem[] | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Delete account (Apple 5.1.1(v)): POST /api/account/delete removes the login and
  // personal data; orders stay for the brand with the name and address removed.
  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Could not delete your account. Please try again.');
      }
      await createClient().auth.signOut().catch(() => {});
      window.location.href = '/';
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete your account. Please try again.');
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    createClient()
      .from('orders')
      .select('id, order_items ( id, product_name, products ( images, brand_profiles ( name ) ) )')
      .eq('consumer_user_id', user.id)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .then(({ data }: { data: OwnedRow[] | null }) => {
        setOwned(
          (data ?? []).flatMap((o) =>
            o.order_items.map((i) => ({
              id: i.id,
              name: i.product_name,
              brand: i.products?.brand_profiles?.name ?? '',
              image: i.products?.images?.[0] ?? null,
            }))
          )
        );
      });
  }, [user]);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
    }
  }, [profile]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('profiles').update({ name }).eq('id', user.id);
    setSaving(false);
    setShowSettings(false);
  }

  return (
    <div className="pb-8">
      <ProfileHeader />

      {/* Owned grid */}
      <div className="px-5 pt-3.5">
        {owned === null ? (
          <div className="grid grid-cols-2 gap-3" aria-busy>
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="h-[190px] animate-pulse bg-surface-dark" />
                <div className="mt-2 h-3.5 w-24 animate-pulse bg-surface-dark" />
              </div>
            ))}
          </div>
        ) : owned.length === 0 ? (
          <div className="border border-line-dark-subtle bg-surface-dark p-[14px]">
            <p className="text-body text-on-primary">Nothing owned yet</p>
            <p className="mt-1 text-caption text-smoke">Things you buy show up here once they&rsquo;re delivered. Then you can pass them on.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-3">
            {owned.map((item) => (
              <li key={item.id}>
                <Link href={`/consumer/owned/${item.id}`} className="block">
                  <Thumb src={item.image} alt={item.name} className="h-[190px] w-full" />
                  <p className="mt-2 truncate px-1.5 text-body-sm text-on-primary">{item.name}</p>
                  <p className="truncate px-1.5 text-label tracking-normal text-smoke">{item.brand}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Account */}
      <section className="mt-10 px-5">
        <p className="text-label uppercase text-smoke">Account</p>
        <div className="mt-3 divide-y divide-line-dark border-y border-line-dark">
          <Link href="/consumer/orders" className="flex items-center justify-between py-3.5 text-body text-on-primary">
            Your orders <ChevronRight className="h-4 w-4 text-accent" />
          </Link>
          <Link href="/consumer/qr" className="flex items-center justify-between py-3.5 text-body text-on-primary">
            Your QR codes <ChevronRight className="h-4 w-4 text-accent" />
          </Link>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            aria-expanded={showSettings}
            className="flex w-full items-center justify-between py-3.5 text-body text-on-primary"
          >
            Account settings
            <ChevronRight className={cn('h-4 w-4 text-accent transition-transform', showSettings && 'rotate-90')} />
          </button>
          <button
            type="button"
            onClick={() => setShowPrivacy(!showPrivacy)}
            aria-expanded={showPrivacy}
            className="flex w-full items-center justify-between py-3.5 text-body text-on-primary"
          >
            Privacy and data
            <ChevronRight className={cn('h-4 w-4 text-accent transition-transform', showPrivacy && 'rotate-90')} />
          </button>
        </div>

        {showPrivacy && <PrivacySettings />}

        {showSettings && (
          <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-label uppercase text-smoke">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full border-b border-line-dark bg-transparent py-2 text-body text-on-primary focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-label uppercase text-smoke">Email</span>
              <input
                type="email"
                value={email}
                disabled
                className="mt-1.5 w-full border-b border-line-dark bg-transparent py-2 text-body text-smoke"
              />
            </label>
            <button type="submit" disabled={saving} className={buttonClasses({ variant: 'flame', fullWidth: true })}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={signOut}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 border border-char text-body text-on-primary hover:border-on-primary"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="mt-4 w-full py-2 text-center text-body-sm text-smoke underline hover:text-on-primary"
          >
            Delete account
          </button>
        ) : (
          <div role="alertdialog" aria-labelledby="delete-title" className="mt-4 border border-line-dark-subtle bg-surface-dark p-4">
            <p id="delete-title" className="text-label uppercase text-accent-bright">Delete account?</p>
            <p className="mt-2 text-body-sm text-ash">
              This deletes your login, profile, Cirkle Points, saved items and privacy choices. You can&rsquo;t undo it.
            </p>
            <p className="mt-2 text-body-sm text-ash">
              Orders you placed stay with the brand for their records, without your name or address. QR codes you&rsquo;ve
              passed on stop earning points.
            </p>
            {deleteError && <p className="mt-3 text-body-sm text-accent-bright">{deleteError}</p>}
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteError('');
                }}
                disabled={deleting}
                className="flex h-11 flex-1 items-center justify-center border border-char text-body text-on-primary hover:border-on-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className={buttonClasses({ variant: 'flame', className: 'flex-1 disabled:opacity-60' })}
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
