import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase-admin';
import BackButton from '@/components/consumer/back-button';

// Figma 12 "About (DPP)". Public like the product page, so a shopper who
// scanned a tag can read it before signing up. Only `materials` and the
// product/brand descriptions exist in the database; the other sections are
// clearly marked placeholders until structured DPP fields exist.

function Section({ title, children, placeholder }: { title: string; children?: React.ReactNode; placeholder: string }) {
  return (
    <section className="mt-6">
      <h2 className="font-brand text-body-lg font-normal uppercase tracking-[0.3px] text-on-primary">{title}</h2>
      {children ? (
        <p className="mt-3 whitespace-pre-line text-body-sm leading-5 text-ash">{children}</p>
      ) : (
        <p className="mt-3 text-body-sm leading-5 text-smoke">{placeholder}</p>
      )}
    </section>
  );
}

export default async function ProductAboutPage({ params }: { params: { productId: string } }) {
  const { data: product } = await createAdminClient()
    .from('products')
    .select('id, name, description, materials, brand_profiles ( name, description )')
    .eq('id', params.productId)
    .eq('is_active', true)
    .single();

  if (!product || !product.brand_profiles) notFound();
  const brand = product.brand_profiles as unknown as { name: string; description: string | null };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-canvas-dark px-5 pb-12 font-brand text-on-primary">
      <header className="grid h-[52px] grid-cols-[1fr_auto_1fr] items-end pb-1">
        <BackButton fallbackHref={`/d/${product.id}`} />
        <h1 className="font-brand text-title font-normal uppercase leading-none tracking-[0.4px]">About</h1>
        <span />
      </header>

      <p className="mt-4 text-label uppercase text-smoke">
        {product.name} · {brand.name}
      </p>
      <p className="mt-1.5 text-body-sm text-ash">A bit like a digital product passport</p>

      <Section title="Materials" placeholder="The brand hasn’t added materials yet.">
        {product.materials}
      </Section>
      <Section title="Composition" placeholder="Composition and care details are coming soon." />
      <Section title="Storytelling" placeholder="The brand hasn’t shared the story behind this piece yet.">
        {product.description || brand.description}
      </Section>

      <div className="mt-10 flex items-center justify-between bg-surface-dark p-4">
        <div>
          <p className="text-body text-on-primary">Repair and care</p>
          <p className="mt-1 text-caption text-smoke">Repair and care guides are coming soon.</p>
        </div>
        <span className="text-[16px] text-smoke" aria-hidden>
          ›
        </span>
      </div>
    </div>
  );
}
