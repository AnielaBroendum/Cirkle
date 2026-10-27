import Link from 'next/link';
import { Logo, buttonClasses, cn } from '@/components/ds';

// Figma "App / 01 Welcome and login". The three buttons are the role links
// (each opens signup with ?role=), same targets as before.
const ROLES = [
  { role: 'consumer', label: "I'm shopping", tone: 'light' },
  { role: 'brand', label: "I'm a brand", tone: 'light' },
  { role: 'retailer', label: "I'm a store", tone: 'outline' },
] as const;

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-flaym-gradient font-brand text-on-primary">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-5 pb-8">
        <div className="flex justify-end pt-6">
          <Link href="/auth/login" className="text-body text-on-primary hover:underline">
            Log in
          </Link>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
          <Logo height={67} />
          <p className="text-caption italic tracking-[3.6px]">FORWARD</p>
        </div>

        <p className="mb-5 text-center text-body-sm">Scan it. Save it. Pass it on.</p>

        <div className="space-y-3">
          {ROLES.map(({ role, label, tone }) => (
            <Link
              key={role}
              href={`/auth/signup?role=${role}`}
              className={buttonClasses({
                size: 'lg',
                fullWidth: true,
                className: cn(
                  'h-[52px] text-body-lg',
                  tone === 'light'
                    ? 'bg-surface text-primary hover:bg-surface/90'
                    : 'border border-char bg-transparent text-on-primary hover:border-on-primary hover:bg-transparent'
                ),
              })}
            >
              {label}
            </Link>
          ))}
        </div>

        <p className="mt-5 text-center text-label leading-[14px] tracking-normal text-ash">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-on-primary underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
