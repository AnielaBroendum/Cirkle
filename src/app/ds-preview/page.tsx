import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DsPreview } from './ds-preview';

export const metadata: Metadata = { title: 'Flaym design system', robots: { index: false } };

// Development-only reference for the Flaym tokens, type, components and icons.
export default function DsPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DsPreview />;
}
