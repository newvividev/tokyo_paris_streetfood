import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
};

loadEnvFile(path.join(cwd, '.env.local'));
loadEnvFile(path.join(cwd, '.env'));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const ok = (label) => console.log(`✓ ${label}`);
const fail = (label, error) => {
  console.error(`✗ ${label}`);
  if (error) console.error(error);
  process.exitCode = 1;
};

const request = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep raw text.
  }
  return { response, body };
};

const run = async () => {
  const routes = ['/', '/login', '/dashboard', '/inventory/ingredients', '/inventory/menu', '/kitchen', '/orders/history', '/settings'];
  for (const route of routes) {
    const { response, body } = await request(new URL(route, baseUrl));
    if (!response.ok) throw new Error(`Route ${route} returned ${response.status}`);
    if (route === '/' && typeof body === 'string' && !body.includes('root')) {
      throw new Error('Root page did not look like the SPA shell');
    }
    ok(`route ${route}`);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('Supabase env missing; skipped database smoke tests.');
    return;
  }

  const headers = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const rest = (table, query = '') => `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}${query}`;
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const readTables = [
    ['menu_items', '?select=id&limit=1'],
    ['ingredients', '?select=id&limit=1'],
    ['menu_recipes', '?select=menu_id,ingredient_id,quantity&limit=1'],
    ['orders', '?select=id&limit=1'],
    ['trucks', '?select=id&limit=1'],
    ['staff_members', '?select=id&limit=1'],
    ['staff_accounts', '?select=staff_id&limit=1'],
    ['role_permissions', '?select=role&limit=1'],
  ];
  for (const [table, query] of readTables) {
    const { response } = await request(rest(table, query), { headers });
    if (!response.ok) throw new Error(`Read check failed for ${table}: ${response.status}`);
    ok(`read ${table}`);
  }

  const truck = { id: `smoke_truck_${id}`, name: `Smoke Truck ${id}`, location: 'Smoke Test', is_active: true };
  const ingredient = { id: `smoke_ing_${id}`, name: `Smoke Ingredient ${id}`, category: 'Smoke', unit: 'kg', unit_cost: 1.25, stock: 2, image: '' };
  const menu = {
    id: `smoke_menu_${id}`,
    name: `Smoke Menu ${id}`,
    category: 'Smoke',
    price: 99,
    cost: 1.25,
    stock: 3,
    sku: `SMOKE-${id}`,
    image: '',
    description: 'Smoke test menu',
    is_active: true,
    truck_id: truck.id,
  };
  const recipe = { menu_id: menu.id, ingredient_id: ingredient.id, quantity: 1.5 };
  const order = {
    id: `smoke_order_${id}`,
    customer: 'Smoke Test',
    items: menu.name,
    total: 99,
    status: 'new',
    time: new Date().toISOString(),
    type: 'dine-in',
    line_items: [{ name: menu.name, qty: 1, station: 'HOT' }],
    created_at: new Date().toISOString(),
    truck_id: truck.id,
    delivery_fee: 0,
    contact_number: '',
  };

  const writeSteps = [
    ['truck', 'POST', rest('trucks'), truck],
    ['ingredient', 'POST', rest('ingredients'), ingredient],
    ['menu', 'POST', rest('menu_items'), menu],
    ['recipe', 'POST', rest('menu_recipes'), recipe],
    ['order', 'POST', rest('orders'), order],
  ];

  for (const [label, method, url, payload] of writeSteps) {
    const { response } = await request(url, { method, headers, body: JSON.stringify(payload) });
    if (response.status !== 201) throw new Error(`${label} insert failed: ${response.status}`);
    ok(`write ${label}`);
  }

  const cleanupSteps = [
    ['menu_recipes', `?menu_id=eq.${encodeURIComponent(menu.id)}&ingredient_id=eq.${encodeURIComponent(ingredient.id)}`],
    ['menu_items', `?id=eq.${encodeURIComponent(menu.id)}`],
    ['ingredients', `?id=eq.${encodeURIComponent(ingredient.id)}`],
    ['orders', `?id=eq.${encodeURIComponent(order.id)}`],
    ['trucks', `?id=eq.${encodeURIComponent(truck.id)}`],
  ];

  for (const [table, query] of cleanupSteps) {
    const { response } = await request(rest(table, query), { method: 'DELETE', headers });
    if (!(response.status === 200 || response.status === 204)) {
      throw new Error(`${table} cleanup failed: ${response.status}`);
    }
    ok(`cleanup ${table}`);
  }
};

run().catch((error) => {
  fail('smoke test failed', error?.stack ?? error?.message ?? error);
  process.exit(1);
});
