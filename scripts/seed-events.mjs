// Seed realistic scan / save / purchase events for the QA brand (Figma update, Part A).
//
//   npm run db:seed-events            # replace the seed data
//   npm run db:seed-events -- --reset # only remove it
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local) and
// TEST_BRAND_EMAIL (.env.test-accounts.local). Everything it writes is marked:
// events have origin = 'seed', orders have a shipping address starting with
// "[seed]", and the extra products use the fixed ids below. --reset removes
// exactly those rows and nothing else.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const brandEmail = process.env.TEST_BRAND_EMAIL;
if (!url || !key || !brandEmail) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or TEST_BRAND_EMAIL.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const resetOnly = process.argv.includes('--reset');

const SEED_PRODUCTS = [
  { id: '5eed0000-0000-4000-8000-000000000001', name: 'Linen Shirt', price_dkk: 89900, sizes: ['XS', 'S', 'M', 'L', 'XL'], category: 'Shirts' },
  { id: '5eed0000-0000-4000-8000-000000000002', name: 'Denim Jacket', price_dkk: 149900, sizes: ['S', 'M', 'L', 'XL'], category: 'Outerwear' },
  { id: '5eed0000-0000-4000-8000-000000000003', name: 'Knit Scarf', price_dkk: 49900, sizes: ['One size'], category: 'Accessories' },
];
const SEED_ADDRESS = '[seed] Testvej 1';
const DAY = 24 * 60 * 60 * 1000;

// Deterministic randomness, so two runs give the same numbers.
let state = 20261027;
function rand() {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
function pickWeighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}
// Middle sizes sell more: weight by distance from the centre of the run.
function sizeWeights(sizes) {
  const mid = (sizes.length - 1) / 2;
  return sizes.map((_, i) => 1 / (1 + Math.abs(i - mid) * 0.9));
}

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) {
    console.error(`${what}: ${error.message}`);
    process.exit(1);
  }
  return data;
}

const brandUser = await must(db.from('profiles').select('id').eq('email', brandEmail).single(), 'QA brand user');
const brand = await must(db.from('brand_profiles').select('id, name').eq('user_id', brandUser.id).single(), 'QA brand');

// --- Reset ---------------------------------------------------------------
await must(db.from('events').delete().eq('brand_id', brand.id).eq('origin', 'seed'), 'delete seed events');
await must(db.from('orders').delete().eq('brand_id', brand.id).like('shipping_address', '[seed]%'), 'delete seed orders');
await must(db.from('products').delete().in('id', SEED_PRODUCTS.map((p) => p.id)), 'delete seed products');
console.log(`Removed earlier seed data for ${brand.name}.`);
if (resetOnly) process.exit(0);

// --- Products, stores, people -------------------------------------------
await must(
  db.from('products').insert(SEED_PRODUCTS.map((p) => ({ ...p, brand_id: brand.id, colors: [], images: [], is_active: true }))),
  'insert seed products'
);
const products = await must(db.from('products').select('id, name, price_dkk, sizes').eq('brand_id', brand.id).eq('is_active', true), 'products');
const stores = await must(db.from('retailer_profiles').select('id, name'), 'stores');
const consumers = await must(db.from('profiles').select('id, email').eq('role', 'consumer'), 'consumers');
const givers = consumers.filter((c) => /qa-(shopper|friend)/.test(c.email));
const shopper = consumers.find((c) => /qa-shopper/.test(c.email)) ?? consumers[0];
if (!stores.length || !consumers.length) {
  console.error('Need at least one store and one consumer.');
  process.exit(1);
}

// Store popularity and product popularity differ, like in real life.
const storeWeights = stores.map((_, i) => [5, 3, 2, 1][i] ?? 1);
const productWeights = products.map((_, i) => [5, 4, 3, 2][i] ?? 1);

// --- Events: 13 months, busier lately --------------------------------------
const now = Date.now();
const events = [];
for (let d = 395; d >= 0; d--) {
  const growth = 1 + (395 - d) / 200; // traffic grows over the year
  const scansToday = Math.round((2 + rand() * 5) * growth);
  for (let n = 0; n < scansToday; n++) {
    const at = now - d * DAY - Math.floor(rand() * (d === 0 ? (now % DAY) : DAY));
    const product = pickWeighted(products, productWeights);
    const given = givers.length > 0 && rand() < 0.15; // passed on by a friend
    const store = given ? null : pickWeighted(stores, storeWeights);
    const giver = given ? pick(givers) : null;
    const signedIn = rand() < 0.75;
    let user = signedIn ? pick(consumers) : null;
    if (user && giver && user.id === giver.id) user = pick(consumers.filter((c) => c.id !== giver.id)) ?? null;

    const base = {
      brand_id: brand.id,
      product_id: product.id,
      user_id: user?.id ?? null,
      retailer_id: store?.id ?? null,
      giver_user_id: giver?.id ?? null,
      // Bulk inserts need every row to have the same keys.
      size: null,
      quantity: 1,
      unit_price_dkk: null,
      origin: 'seed',
    };
    events.push({ ...base, type: 'scan', occurred_at: new Date(at).toISOString() });
    if (!user) continue;

    const sizes = product.sizes?.length ? product.sizes : [null];
    const size = sizes.length === 1 ? sizes[0] : pickWeighted(sizes, sizeWeights(sizes));
    const saves = rand() < 0.32;
    const buys = saves ? rand() < 0.16 : rand() < 0.02;
    if (saves) {
      events.push({ ...base, type: 'save', size, occurred_at: new Date(Math.min(at + rand() * 2 * DAY, now)).toISOString() });
    }
    if (buys) {
      events.push({
        ...base,
        type: 'purchase',
        size,
        quantity: 1,
        unit_price_dkk: product.price_dkk,
        occurred_at: new Date(Math.min(at + (1 + rand() * 6) * DAY, now)).toISOString(),
      });
    }
  }
}
for (let i = 0; i < events.length; i += 500) {
  await must(db.from('events').insert(events.slice(i, i + 500)), 'insert events');
}

// --- A few real New orders, so the Orders page has work to do ---------------
// Ages 0, 1, 3 and 4 days: the last two are past the 2-day "Waiting" limit.
const orderAges = [0, 1, 3, 4];
for (const [i, age] of orderAges.entries()) {
  const product = products[i % products.length];
  const store = stores[i % stores.length];
  const size = product.sizes?.length ? product.sizes[Math.floor(product.sizes.length / 2)] : null;
  const createdAt = new Date(now - age * DAY - 2 * 60 * 60 * 1000).toISOString();
  const order = await must(
    db
      .from('orders')
      .insert({
        consumer_user_id: shopper.id,
        brand_id: brand.id,
        status: 'pending',
        total_dkk: product.price_dkk,
        shipping_name: 'QA Shopper',
        shipping_address: SEED_ADDRESS,
        shipping_city: 'København',
        shipping_postal_code: '2200',
        shipping_country: 'DK',
        created_at: createdAt,
      })
      .select('id')
      .single(),
    'insert order'
  );
  const item = await must(
    db
      .from('order_items')
      .insert({ order_id: order.id, product_id: product.id, product_name: product.name, size, quantity: 1, unit_price_dkk: product.price_dkk })
      .select('id')
      .single(),
    'insert order item'
  );
  await must(db.from('order_events').insert({ order_id: order.id, status: 'pending', note: 'Order placed', created_at: createdAt }), 'insert order event');
  await must(
    db.from('attributions').insert({
      order_id: order.id,
      attribution_type: 'deferred',
      source_retailer_id: store.id,
      commission_rate: 1500,
      commission_amount_dkk: Math.round(product.price_dkk * 0.15),
      status: 'pending',
      attribution_window_expires_at: new Date(now + 90 * DAY).toISOString(),
    }),
    'insert attribution'
  );
  await must(
    db.from('events').insert({
      type: 'purchase',
      user_id: shopper.id,
      brand_id: brand.id,
      product_id: product.id,
      size,
      retailer_id: store.id,
      order_id: order.id,
      order_item_id: item.id,
      quantity: 1,
      unit_price_dkk: product.price_dkk,
      occurred_at: createdAt,
      origin: 'seed',
    }),
    'insert order purchase event'
  );
}

const count = (t) => events.filter((e) => e?.type === t).length;
console.log(
  `Seeded ${brand.name}: ${products.length} products, ${stores.length} stores, ` +
    `${count('scan')} scans, ${count('save')} saves, ${count('purchase') + orderAges.length} purchases, ` +
    `${events.filter((e) => e?.giver_user_id).length} events passed on by a friend, ${orderAges.length} New orders.`
);
