import ConsumerShell from '@/components/consumer/consumer-shell';
import { consumerViewport } from '@/components/consumer/viewport';

export const viewport = consumerViewport;

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return <ConsumerShell>{children}</ConsumerShell>;
}
