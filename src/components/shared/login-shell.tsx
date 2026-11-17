import Link from 'next/link';
import { Logo } from '@/components/ds';

type LoginShellProps = {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
};

// Figma "Portals v2 / 01 Login" (368:480, 368:518): gradient brand panel beside a dark
// login card, on the v2 page colour. One login page serves brands, stores and shoppers,
// so the panel tag doesn't name a portal. `portal-dark` gives the ds form controls their
// dark look. Below lg the panel becomes a short band above the card.
export function LoginShell({ eyebrow, title, intro, children }: LoginShellProps) {
  return (
    <main className="portal-dark flex min-h-screen flex-col gap-4 bg-canvas-dark p-4 font-brand lg:flex-row">
      <Link
        href="/"
        aria-label="Flaym home"
        className="flex h-44 shrink-0 flex-col justify-between bg-flaym-welcome p-5 lg:sticky lg:top-4 lg:h-[calc(100vh-32px)] lg:flex-1 lg:p-10"
      >
        <span className="flex items-center justify-between">
          <span className="bg-obsidian/35 px-3 py-1.5 text-caption font-medium text-flare">Flaym</span>
          <span className="text-caption text-obsidian">flaymforward.com</span>
        </span>
        <span className="flex flex-col items-center gap-2.5">
          <Logo height={36} className="lg:hidden" />
          <Logo height={128} className="hidden lg:inline-block" />
          <span className="text-caption font-medium tracking-[5.6px] text-flare lg:text-body">FORWARD</span>
        </span>
        <span className="hidden flex-col gap-1.5 lg:flex">
          <span className="text-heading-xl font-medium tracking-[-0.28px] text-flare">Fashion worth wanting.</span>
          <span className="text-body-sm text-flare/80">Find it. Flaym it. Forward.</span>
        </span>
      </Link>

      <div className="flex flex-1 items-start justify-center py-6 lg:w-[560px] lg:flex-none lg:items-center lg:py-0">
        <div className="flex w-full max-w-[440px] flex-col gap-[18px] border border-line-dark-subtle bg-obsidian p-6 sm:p-9">
          <div className="flex flex-col gap-[18px]">
            <p className="text-label uppercase text-accent-bright">{eyebrow}</p>
            <h1 className="text-display font-medium tracking-[-0.72px] text-flare">{title}</h1>
            {intro && <p className="text-body-sm text-ash">{intro}</p>}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
