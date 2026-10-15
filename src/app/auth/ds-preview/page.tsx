'use client';

// TEMPORARY — design-system preview for comparing against Figma. Delete when the redesign is done.
// Lives under /auth only because /auth is public in middleware. No data, auth or redirects.

import { useState } from 'react';
import {
  Home, Heart, ShoppingBag, User, LayoutDashboard, Package, QrCode, Inbox, Handshake,
  LogOut, Search, Bell, Eye, TrendingUp, Coins,
} from 'lucide-react';
import {
  Logo, Button, buttonClasses, Field, Input, Textarea, Select, Checkbox, Toggle, Card, CardHeader,
  Badge, StatusPill, Avatar, Modal, Tabs, TopBar, BottomNav, SidebarNav, EmptyState, Skeleton,
  KPISkeleton, ListSkeleton, CardSkeleton, Toast, ToastProvider, useToast, StatTile, List, ListRow,
  Table, THead, TBody, TR, TH, TD, ProductCard, type NavItem,
} from '@/components/ds';

const HERE = '/auth/ds-preview';

const CONSUMER_NAV: NavItem[] = [
  { href: HERE, label: 'Home', icon: Home },
  { href: '#saved', label: 'Saved', icon: Heart },
  { href: '#orders', label: 'Orders', icon: ShoppingBag },
  { href: '#profile', label: 'Profile', icon: User },
];

const BRAND_NAV: NavItem[] = [
  { href: HERE, label: 'Dashboard', icon: LayoutDashboard },
  { href: '#products', label: 'Products', icon: Package },
  { href: '#samples', label: 'Samples', icon: QrCode },
  { href: '#requests', label: 'Sample requests', icon: Inbox },
  { href: '#partnerships', label: 'Partnerships', icon: Handshake },
  { href: '#orders', label: 'Orders', icon: ShoppingBag },
];

function Section({ title, source, children }: { title: string; source: 'Figma' | 'Derived'; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="font-brand text-heading-lg uppercase">{title}</h2>
        <Badge tone={source === 'Figma' ? 'accent' : 'outline'}>{source}</Badge>
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-label uppercase text-muted">{children}</p>;
}

function ToastButtons() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => toast('Order placed')}>success</Button>
      <Button size="sm" variant="secondary" onClick={() => toast('Low stock on size M', 'warning')}>warning</Button>
      <Button size="sm" variant="secondary" onClick={() => toast('Link copied', 'info')}>info</Button>
      <Button size="sm" variant="secondary" onClick={() => toast('Could not save changes', 'error')}>error</Button>
    </div>
  );
}

export default function DesignSystemPreview() {
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toggle, setToggle] = useState(true);
  const [range, setRange] = useState('month');
  const [saved, setSaved] = useState(false);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-canvas font-brand text-primary">
        <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
          {/* Header — mirrors the Figma foundations frame */}
          <header className="flex flex-wrap items-start justify-between gap-6 py-10">
            <div>
              <p className="text-label uppercase text-muted">Flaym Forward · UI foundations</p>
              <h1 className="mt-2 font-brand text-heading-xl uppercase sm:text-display">Component library</h1>
              <p className="mt-2 text-caption text-muted">Temporary preview — /auth/ds-preview. “Figma” = drawn in Figma; “Derived” = built from the foundations.</p>
            </div>
            <Logo height={28} framed />
          </header>

          <Section title="Colours" source="Figma">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['bg-accent', 'accent', '#FF5000'],
                ['bg-surface border border-line', 'surface / canvas', '#FFFFFF'],
                ['bg-line', 'line', '#D5D1C8'],
                ['bg-muted', 'muted', '#7B7673'],
                ['bg-primary', 'primary / canvas-dark', '#2C2324'],
                ['bg-flaym-gradient', 'flaym-gradient', 'placeholder'],
              ].map(([cls, name, hex]) => (
                <div key={name}>
                  <div className={`h-20 ${cls}`} />
                  <p className="mt-2 text-body">{name}</p>
                  <p className="text-caption text-muted">{hex}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Type · IBM Plex Mono" source="Figma">
            <div className="space-y-3">
              <p className="text-display uppercase">Display 36</p>
              <p className="text-heading-xl uppercase">Header 32 · uppercase</p>
              <p className="text-heading-lg uppercase">Header 20 · uppercase</p>
              <p className="text-body">body 14 · lowercase, regular</p>
              <p className="text-caption text-muted">caption 12 · char</p>
              <p className="text-label uppercase text-muted">Label 11 · uppercase</p>
            </div>
          </Section>

          <Section title="Button" source="Figma">
            <Label>Variants (md = Figma, 44px)</Label>
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="accent">Accent</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <Label>
              <span className="mt-6 block">Sizes · states</span>
            </Label>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button variant="accent" leftIcon={<ShoppingBag className="h-4 w-4" />}>Buy now</Button>
              <Button loading>Saving</Button>
              <Button variant="secondary" disabled>Disabled</Button>
              <a href="#" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>Link as button</a>
            </div>
            <div className="mt-4 max-w-sm">
              <Button variant="accent" size="lg" fullWidth>Full width CTA</Button>
            </div>
          </Section>

          <Section title="Badge · status pill" source="Figma">
            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">New</Badge>
              <Badge tone="neutral">Shipped</Badge>
              <Badge tone="success">Delivered</Badge>
              <Badge tone="warning">Pending</Badge>
              <Badge tone="outline">Cancelled</Badge>
              <Badge tone="dark">Sample</Badge>
            </div>
            <Label>
              <span className="mt-6 block">StatusPill from database values</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'requested', 'return_shipped', 'inspected_damaged', 'active', 'invited', 'deposit_refunded'].map((s) => (
                <StatusPill key={s} status={s} />
              ))}
            </div>
          </Section>

          <Section title="Form controls" source="Figma">
            <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
              <Field label="Input label" htmlFor="ds-name">
                <Input id="ds-name" defaultValue="Value" />
              </Field>
              <Field label="Email" htmlFor="ds-email" hint="We'll send the order confirmation here.">
                <Input id="ds-email" type="email" placeholder="you@example.com" />
              </Field>
              <Field label="Price (kr)" htmlFor="ds-price" error="Price must be greater than 0">
                <Input id="ds-price" invalid defaultValue="0" />
              </Field>
              <Field label="Size" htmlFor="ds-size">
                <Select id="ds-size" defaultValue="m">
                  <option value="s">S</option>
                  <option value="m">M</option>
                  <option value="l">L</option>
                </Select>
              </Field>
              <Field label="Description (textarea — derived)" htmlFor="ds-desc" className="sm:col-span-2">
                <Textarea id="ds-desc" placeholder="Materials, fit, care…" />
              </Field>
              <div className="flex flex-col gap-3">
                <Checkbox label="Accept partnership terms" defaultChecked />
                <Checkbox label="Unchecked" />
              </div>
              <Toggle checked={toggle} onCheckedChange={setToggle} label={toggle ? 'Notifications on' : 'Notifications off'} />
            </div>
          </Section>

          <Section title="Tabs · segmented control" source="Figma">
            <Tabs
              items={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
              value={range}
              onValueChange={setRange}
            />
            <p className="mt-2 text-caption text-muted">Selected: {range}</p>
            <Label>
              <span className="mt-6 block">Underline tabs (derived)</span>
            </Label>
            <Tabs
              variant="underline"
              items={[
                { value: 'all', label: 'All', count: 24 },
                { value: 'pending', label: 'Pending', count: 3 },
                { value: 'shipped', label: 'Shipped', count: 8 },
                { value: 'delivered', label: 'Delivered', count: 13 },
              ]}
            />
          </Section>

          <Section title="Card · avatar" source="Derived">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader eyebrow="Partnership" title="Atelier Nord" action={<StatusPill status="active" />} />
                <p className="text-body text-muted">Commission 25% direct · 15% deferred · 10% tier-2.</p>
              </Card>
              <Card tone="dark">
                <CardHeader eyebrow="Cirkle points" title="1 250 pts" />
                <p className="text-body text-on-primary/70">Worth 1 250 kr on your next purchase.</p>
              </Card>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Avatar name="Aniela Brøndum" size="sm" />
              <Avatar name="Atelier Nord" />
              <Avatar name="Kaffe Bar" size="lg" />
              <Avatar name="Peer" shape="circle" />
              <Avatar name="Mira Holm" size="lg" shape="circle" />
            </div>
          </Section>

          <Section title="Stat / KPI tile" source="Derived">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile label="Scans" value="1 284" delta="+12%" hint="vs last month" icon={<Eye className="h-4 w-4" />} />
              <StatTile label="Sales" value="86" delta="+4" hint="this month" icon={<TrendingUp className="h-4 w-4" />} />
              <StatTile label="Commission owed" value="4 320 kr" tone="accent" />
              <StatTile label="Deposits held" value="12 900 kr" tone="dark" icon={<Coins className="h-4 w-4" />} />
            </div>
          </Section>

          <Section title="List row · table" source="Derived">
            <List className="max-w-xl">
              <ListRow
                leading={<Avatar name="Kaffe Bar" />}
                title="Kaffe Bar Nørrebro"
                subtitle="4 samples · 312 scans"
                trailing={<StatusPill status="active" />}
                href="#"
              />
              <ListRow
                leading={<div className="h-10 w-10 bg-flaym-gradient" />}
                title="Order #A1B2C3 · Wool overshirt"
                subtitle="2 days ago"
                trailing={<span className="text-body font-medium">1 499,00 kr</span>}
                onClick={() => {}}
              />
              <ListRow title="Static row" subtitle="No link, no chevron" trailing={<StatusPill status="pending" />} />
            </List>
            <div className="mt-6">
              <Table>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    <TH>Customer</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Total</TH>
                  </TR>
                </THead>
                <TBody>
                  {[
                    ['#A1B2C3', 'Mira Holm', 'pending', '1 499,00 kr'],
                    ['#D4E5F6', 'Jonas Berg', 'shipped', '899,00 kr'],
                    ['#G7H8I9', 'Sara Lind', 'delivered', '2 150,00 kr'],
                  ].map(([id, name, status, total]) => (
                    <TR key={id}>
                      <TD className="font-medium">{id}</TD>
                      <TD>{name}</TD>
                      <TD><StatusPill status={status} /></TD>
                      <TD className="text-right">{total}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Section>

          <Section title="Product card" source="Derived">
            <div className="grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
              <ProductCard brand="Atelier Nord" name="Wool overshirt" price={149900} href="#" badge={{ label: 'New', tone: 'accent' }} saved={saved} onToggleSave={() => setSaved(!saved)} />
              <ProductCard brand="Studio Lys" name="Linen trousers, relaxed fit" price={89900} href="#" />
              <ProductCard brand="Hav" name="Knit beanie" price={34900} badge={{ label: 'Sample' }} />
            </div>
            <p className="mt-2 text-caption text-muted">No image → flaym gradient placeholder (per Figma).</p>
          </Section>

          <Section title="Modal · sheet · toast" source="Derived">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
              <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open sheet</Button>
            </div>
            <Label>
              <span className="mt-6 block">Toasts (click to trigger)</span>
            </Label>
            <ToastButtons />
            <div className="mt-4 flex max-w-sm flex-col gap-2">
              <Toast message="Order placed" type="success" />
              <Toast message="Low stock on size M" type="warning" />
              <Toast message="Link copied" type="info" />
              <Toast message="Could not save changes" type="error" />
            </div>
            <Modal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Approve request"
              footer={
                <>
                  <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button fullWidth onClick={() => setModalOpen(false)}>Approve</Button>
                </>
              }
            >
              <p className="text-muted">Kaffe Bar requests 3 samples. A deposit of 1 200 kr will be charged.</p>
            </Modal>
            <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} variant="sheet" title="Choose size">
              <div className="grid grid-cols-4 gap-2">
                {['XS', 'S', 'M', 'L'].map((s) => (
                  <Button key={s} variant={s === 'M' ? 'primary' : 'secondary'} onClick={() => setSheetOpen(false)}>{s}</Button>
                ))}
              </div>
            </Modal>
          </Section>

          <Section title="Empty state · skeletons" source="Derived">
            <EmptyState
              icon={<Heart className="h-5 w-5" />}
              title="Nothing saved yet"
              description="Scan a tag in a store, or tap the heart on a product to save it here."
              action={<Button variant="accent">Discover products</Button>}
            />
            <div className="mt-6 space-y-4">
              <Skeleton className="h-4 w-48" />
              <KPISkeleton />
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                <ListSkeleton rows={3} />
                <CardSkeleton />
              </div>
            </div>
          </Section>

          <Section title="Top bar" source="Derived">
            <div className="max-w-sm space-y-3 border border-line">
              <TopBar sticky={false} title="Order details" onBack={() => {}} right={<Button variant="ghost" size="sm"><Bell className="h-4 w-4" /></Button>} />
              <TopBar sticky={false} logo right={<Button variant="ghost" size="sm"><Search className="h-4 w-4" /></Button>} />
              <TopBar sticky={false} tone="dark" logo />
              <TopBar sticky={false} tone="dark" title="Checkout" onBack={() => {}} />
            </div>
          </Section>

          <Section title="Bottom navigation (consumer PWA)" source="Derived">
            <div className="max-w-sm border border-line">
              <div className="flex h-40 items-center justify-center bg-canvas text-caption text-muted">screen content</div>
              <BottomNav items={CONSUMER_NAV} fixed={false} />
            </div>
          </Section>

          <Section title="Sidebar (brand / retailer)" source="Derived">
            <div className="flex h-[560px] overflow-hidden border border-line">
              <div className="flex w-full flex-col lg:flex-row">
                <SidebarNav
                  embedded
                  items={BRAND_NAV}
                  homeHref={HERE}
                  account={{ name: 'Atelier Nord', role: 'Brand' }}
                  footer={(close) => (
                    <button type="button" onClick={close} className="flex w-full items-center gap-3 px-2 py-2.5 text-body text-on-primary/60 hover:text-on-primary">
                      <LogOut className="h-[18px] w-[18px]" />
                      Sign out
                    </button>
                  )}
                />
                <div className="flex-1 bg-canvas p-6">
                  <p className="text-label uppercase text-muted">Dashboard</p>
                  <h3 className="mt-1 font-brand text-heading-lg uppercase">Good morning</h3>
                  <p className="mt-2 text-caption text-muted">Below lg the sidebar collapses into a top bar with a drawer.</p>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </ToastProvider>
  );
}
