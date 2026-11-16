import { consumerViewport } from '@/components/consumer/viewport';

// Public product pages are consumer screens: v2 status-bar colour.
export const viewport = consumerViewport;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
