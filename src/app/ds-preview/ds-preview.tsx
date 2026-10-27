'use client';

import {
  AccountIcon,
  Badge,
  BottomNav,
  Button,
  Card,
  CardHeader,
  DashboardIcon,
  Field,
  FlaymsIcon,
  Input,
  LogOutIcon,
  OrdersIcon,
  ProductsIcon,
  ProfileIcon,
  ReturnsIcon,
  ScanIcon,
  SidebarNav,
  StatTile,
  StatusPill,
  StoreProfileIcon,
  StoresQrIcon,
  Tabs,
  Toggle,
  buttonClasses,
  type NavItem,
} from '@/components/ds';
import { useState } from 'react';

const SWATCHES = [
  { name: 'flare', figma: 'text/primary', hex: '#FFFFFF', className: 'bg-flare' },
  { name: 'ash', figma: 'text/secondary', hex: '#D5D1C8', className: 'bg-ash' },
  { name: 'smoke', figma: 'text/tertiary', hex: '#ACA7A1', className: 'bg-smoke' },
  { name: 'char', figma: 'line/char', hex: '#7B7673', className: 'bg-char' },
  { name: 'flaym', figma: 'brand/flaym', hex: '#FF5000', className: 'bg-flaym' },
  { name: 'obsidian', figma: 'surface/obsidian', hex: '#2C2324', className: 'bg-obsidian' },
  { name: 'cinder', figma: 'light/text secondary', hex: '#4A3E3F', className: 'bg-cinder' },
  { name: 'slate', figma: 'light/text tertiary', hex: '#5E5856', className: 'bg-slate' },
  { name: 'warning-text', figma: 'status/warning text', hex: '#8A5200', className: 'bg-warning-text' },
];

const TYPE_SCALE = [
  { token: 'text-display', size: '36px', upper: true },
  { token: 'text-heading-xl', size: '32px', upper: true },
  { token: 'text-heading-lg', size: '20px', upper: true },
  { token: 'text-title', size: '18px' },
  { token: 'text-body-lg', size: '15px' },
  { token: 'text-body', size: '14px' },
  { token: 'text-body-sm', size: '13px' },
  { token: 'text-caption', size: '12px' },
  { token: 'text-label', size: '12px', upper: true },
  { token: 'text-button', size: '14px', upper: true },
];

const ICONS = [
  { name: 'ScanIcon', Icon: ScanIcon },
  { name: 'FlaymsIcon', Icon: FlaymsIcon },
  { name: 'ProfileIcon', Icon: ProfileIcon },
  { name: 'DashboardIcon', Icon: DashboardIcon },
  { name: 'ProductsIcon', Icon: ProductsIcon },
  { name: 'StoresQrIcon', Icon: StoresQrIcon },
  { name: 'OrdersIcon', Icon: OrdersIcon },
  { name: 'ReturnsIcon', Icon: ReturnsIcon },
  { name: 'AccountIcon', Icon: AccountIcon },
  { name: 'StoreProfileIcon', Icon: StoreProfileIcon },
  { name: 'LogOutIcon', Icon: LogOutIcon },
];

const APP_TABS: NavItem[] = [
  { href: '/ds-preview', label: 'Scan', icon: ScanIcon },
  { href: '/consumer/flayms', label: 'Flayms', icon: FlaymsIcon },
  { href: '/consumer/profile', label: 'Profile', icon: ProfileIcon },
];

const PORTAL_NAV: NavItem[] = [
  { href: '/ds-preview', label: 'Dashboard', icon: DashboardIcon },
  { href: '/brand/products', label: 'Products', icon: ProductsIcon },
  { href: '/brand/samples', label: 'Stores & QR tags', icon: StoresQrIcon },
  { href: '/brand/orders', label: 'Orders', icon: OrdersIcon },
  { href: '/brand/returns', label: 'Returns', icon: ReturnsIcon },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-line pb-2 text-heading-lg uppercase text-primary">{title}</h2>
      {children}
    </section>
  );
}

export function DsPreview() {
  const [toggle, setToggle] = useState(true);
  return (
    <main className="min-h-screen bg-canvas-warm font-brand text-primary">
      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
        <header>
          <p className="text-label uppercase text-slate">Flaym Forward · development only</p>
          <h1 className="mt-2 text-display uppercase">Design system</h1>
          <p className="mt-2 text-body text-cinder">Tokens, type, components and icons from the Figma file.</p>
        </header>

        <Section title="Colours">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SWATCHES.map((s) => (
              <div key={s.name} className="border border-line bg-surface">
                <div className={`h-16 border-b border-line ${s.className}`} />
                <div className="p-3">
                  <p className="text-body font-medium">{s.name}</p>
                  <p className="text-caption text-slate">{s.figma}</p>
                  <p className="text-caption text-slate">{s.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Text levels">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 bg-canvas-dark p-5">
              <p className="text-label uppercase text-smoke">Dark app</p>
              <p className="text-body text-flare">Flare: primary text</p>
              <p className="text-body text-ash">Ash: secondary text, brand names</p>
              <p className="text-body text-smoke">Smoke: meta, labels, inactive tabs</p>
              <div className="mt-3 border-t border-char pt-3 text-caption text-smoke">Char is the line above, never text.</div>
            </div>
            <div className="space-y-1 border border-line bg-surface p-5">
              <p className="text-label uppercase text-slate">Light portals</p>
              <p className="text-body text-obsidian">Obsidian: primary text</p>
              <p className="text-body text-cinder">Cinder: secondary text</p>
              <p className="text-body text-slate">Slate: meta, labels, table headers</p>
              <div className="mt-3 border-t border-line pt-3 text-caption text-slate">Borders on light use Ash.</div>
            </div>
          </div>
        </Section>

        <Section title="Type scale">
          <div className="space-y-3 border border-line bg-surface p-5">
            {TYPE_SCALE.map((t) => (
              <div key={t.token} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className={`${t.token} ${t.upper ? 'uppercase' : ''}`}>Scan it. Save it.</p>
                <p className="text-caption text-slate">
                  {t.token} · {t.size}
                  {t.upper ? ' · uppercase' : ''}
                </p>
              </div>
            ))}
            <p className="border-t border-line pt-3 text-caption text-slate">
              Weights: <span className="font-normal">400</span> · <span className="font-medium">500</span> ·{' '}
              <span className="font-semibold">600</span>
            </p>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="space-y-3 border border-line bg-surface p-5">
            {(['primary', 'accent', 'secondary', 'ghost'] as const).map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-3">
                <Button variant={variant} size="sm">Small</Button>
                <Button variant={variant}>{variant}</Button>
                <Button variant={variant} size="lg">Large</Button>
                <Button variant={variant} loading>Loading</Button>
              </div>
            ))}
            <a href="#" className={buttonClasses({ variant: 'accent' })}>Link as button</a>
          </div>
          <div className="flex flex-wrap gap-3 bg-canvas-dark p-5">
            <Button variant="accent">Start scanning</Button>
            <Button variant="secondary">Pass it on</Button>
          </div>
        </Section>

        <Section title="Pills and badges">
          <div className="flex flex-wrap gap-2 border border-line bg-surface p-5">
            <Badge tone="accent">New</Badge>
            <Badge tone="neutral">Shipped</Badge>
            <Badge tone="success">Delivered</Badge>
            <Badge tone="warning">Pending</Badge>
            <Badge tone="outline">Cancelled</Badge>
            <Badge tone="dark">Dark</Badge>
            <StatusPill status="confirmed" />
          </div>
        </Section>

        <Section title="Forms, tabs, cards">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader eyebrow="Eyebrow" title="Card header" />
              <div className="mt-4 space-y-4">
                <Field label="Input label" htmlFor="ds-input" hint="Hint text in Slate.">
                  <Input id="ds-input" placeholder="Placeholder" />
                </Field>
                <Toggle checked={toggle} onCheckedChange={setToggle} label="Share my data with brands" />
              </div>
            </Card>
            <div className="space-y-4">
              <Tabs items={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} defaultValue="month" />
              <Tabs variant="underline" items={[{ value: 'new', label: 'New', count: 3 }, { value: 'all', label: 'All' }]} defaultValue="new" />
              <StatTile label="Scans this week" value="128" delta="+12%" hint="vs. last week" />
            </div>
          </div>
        </Section>

        <Section title="Icons">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ICONS.map(({ name, Icon }) => (
              <div key={name} className="flex items-center gap-3 border border-line bg-surface p-3">
                <span className="grid h-10 w-10 place-items-center bg-canvas-dark text-smoke">
                  <Icon />
                </span>
                <span className="grid h-10 w-10 place-items-center text-primary">
                  <Icon />
                </span>
                <span className="truncate text-caption text-slate">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Navigation">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-[420px] overflow-hidden border border-line">
              <SidebarNav embedded items={PORTAL_NAV} homeHref="/ds-preview" account={{ name: 'Studio Nord', role: 'Brand' }} />
            </div>
            <div className="flex flex-col justify-end border border-line bg-canvas-dark">
              <BottomNav fixed={false} items={APP_TABS} />
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}
