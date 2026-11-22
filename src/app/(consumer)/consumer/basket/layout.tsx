import { NativeBuyGuard } from '@/components/consumer/native-buy-guard';

// No payments in the iPhone app yet (TestFlight): "Coming soon" there, unchanged on the web.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <NativeBuyGuard>{children}</NativeBuyGuard>;
}
