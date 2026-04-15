import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const cwd = process.cwd();
const baseUrl = process.env.SMOKE_BASE_URL ?? process.env.PROD_BASE_URL ?? 'http://127.0.0.1:3000';
const smokeTarget = process.env.SMOKE_TARGET ?? (process.env.PROD_BASE_URL ? 'production' : 'local');

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

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars');
}

const headers = {
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const rest = (table, query = '') => `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}${query}`;

const requestJson = async (method, url, body) => {
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { response, body: parsed };
};

const sha256 = async (input) => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.webcrypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

const waitForRow = async (table, query) => {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const { response, body } = await requestJson('GET', rest(table, query));
    if (response.ok && Array.isArray(body) && body.length > 0) {
      return body[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${table}${query}`);
};

const waitForRowField = async (table, query, field, expectedValue) => {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const row = await waitForRow(table, query);
    if (String(row?.[field]) === String(expectedValue)) {
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${table}.${field} = ${expectedValue}`);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

console.log(`[browser] target=${smokeTarget} baseUrl=${baseUrl}`);

const pngPath = path.join('/tmp', `browser-smoke-${Date.now()}.png`);
fs.writeFileSync(
  pngPath,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl4xX8AAAAASUVORK5CYII=',
    'base64',
  ),
);

const token = Date.now().toString(36);
const staffId = `browser-staff-${token}`;
const username = `browser.manager.${token}`;
const password = 'SmokePass123!';
const passwordHash = await sha256(password);
const staffName = `Browser Manager ${token}`;
const ingredientName = `Browser Ingredient ${token}`;
const updatedIngredientName = `${ingredientName} Updated`;
const menuName = `Browser Menu ${token}`;
const customerName = `Browser Guest ${token}`;
const noteText = `Browser smoke ${token}`;

let createdIngredientId = null;
let createdMenuId = null;
let createdOrderId = null;

await requestJson('POST', rest('staff_members'), {
  id: staffId,
  name: staffName,
  role: 'Manager',
  image: '',
  is_active: true,
});
await requestJson('POST', rest('staff_accounts'), {
  staff_id: staffId,
  username,
  password_hash: passwordHash,
  is_active: true,
  must_change_password: false,
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
await context.addInitScript(
  ({ storeMode, theme }) => {
    localStorage.setItem('ops_store_mode', storeMode);
    localStorage.setItem('ops_theme', theme);
  },
  { storeMode: 'open', theme: 'dark' },
);

const page = await context.newPage();
page.on('console', (message) => {
  console.log(`[browser:${message.type()}] ${message.text()}`);
});
page.on('pageerror', (error) => {
  console.log(`[browser:error] ${error.message}`);
});
page.on('dialog', async (dialog) => {
  await dialog.accept();
});

const cleanup = async () => {
  if (createdOrderId) {
    await requestJson('DELETE', rest('orders', `?id=eq.${encodeURIComponent(createdOrderId)}`));
  }
  if (createdMenuId) {
    await requestJson('DELETE', rest('menu_recipes', `?menu_id=eq.${encodeURIComponent(createdMenuId)}`));
    await requestJson('DELETE', rest('menu_items', `?id=eq.${encodeURIComponent(createdMenuId)}`));
  }
  if (createdIngredientId) {
    await requestJson('DELETE', rest('ingredients', `?id=eq.${encodeURIComponent(createdIngredientId)}`));
  }
  await requestJson('DELETE', rest('staff_accounts', `?staff_id=eq.${encodeURIComponent(staffId)}`));
  await requestJson('DELETE', rest('staff_members', `?id=eq.${encodeURIComponent(staffId)}`));
};

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByTestId('login-language-toggle').click();
  await page.waitForSelector('select[data-testid="login-username"]');
  await page.selectOption('[data-testid="login-username"]', { label: username });
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/dashboard');
  await page.getByTestId('store-mode-toggle').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const truckSelect = document.querySelector('[data-testid="truck-select"]');
    return Boolean(truckSelect && truckSelect instanceof HTMLSelectElement && truckSelect.value);
  });
  assert(page.url().includes('/dashboard'), 'Did not reach dashboard after login');

  await page.getByTestId('nav-inventoryIngredients').click();
  await page.waitForURL('**/inventory/ingredients');
  await page.waitForSelector('[data-testid="ingredient-name"]');

  await page.getByTestId('ingredient-name').fill(ingredientName);
  await page.getByTestId('ingredient-stock').fill('15');
  await page.getByTestId('ingredient-cost').fill('25');
  await page.setInputFiles('[data-testid="ingredient-image"]', pngPath);
  await page.getByTestId('ingredient-submit').click();

  const ingredient = await waitForRow('ingredients', `?select=*&name=eq.${encodeURIComponent(ingredientName)}&limit=1`);
  createdIngredientId = ingredient.id;
  assert(ingredient.name === ingredientName, 'Ingredient was not saved to Supabase');

  await page.getByTestId('nav-inventoryMenu').click();
  await page.waitForURL('**/inventory/menu');
  await page.waitForSelector('[data-testid="menu-name"]');
  console.log(`[browser] truck select value: ${await page.locator('[data-testid="truck-select"]').inputValue()}`);

  await page.getByTestId('menu-name').fill(menuName);
  await page.setInputFiles('[data-testid="menu-image"]', pngPath);
  await page.getByTestId('menu-recipe-ingredient').selectOption({ value: createdIngredientId });
  await page.getByTestId('menu-recipe-qty').fill('2');
  await page.getByTestId('menu-recipe-add').click();
  await page.getByTestId('menu-price').fill('250');
  await page.getByTestId('menu-stock').fill('20');
  await page.getByTestId('menu-submit').click();

  const menu = await waitForRow('menu_items', `?select=*&name=eq.${encodeURIComponent(menuName)}&limit=1`);
  createdMenuId = menu.id;
  assert(menu.name === menuName, 'Menu was not saved to Supabase');
  console.log(`[browser] created menu truck_id: ${menu.truck_id ?? menu.truckId ?? ''}, active: ${menu.is_active ?? menu.active}`);

  const recipe = await waitForRow('menu_recipes', `?select=*&menu_id=eq.${encodeURIComponent(createdMenuId)}&limit=1`);
  assert(recipe.menu_id === createdMenuId, 'Recipe was not saved to Supabase');

  const orderPayload = {
    id: `browser-order-${token}`,
    customer: customerName,
    items: menuName,
    total: 250,
    status: 'new',
    time: new Date().toISOString(),
    type: 'dine-in',
    note: noteText,
    line_items: [{ name: menuName, qty: 1, station: 'HOT' }],
    created_at: new Date().toISOString(),
    truck_id: menu.truck_id ?? null,
    delivery_fee: 0,
    contact_number: '',
  };
  const { response: orderInsertResponse, body: orderInsertBody } = await requestJson('POST', rest('orders'), orderPayload);
  assert(orderInsertResponse.ok, `Failed to insert browser order: ${orderInsertResponse.status}`);
  const order = Array.isArray(orderInsertBody) ? orderInsertBody[0] : orderInsertBody;
  createdOrderId = order.id;
  assert(order.customer === customerName, 'Order was not saved to Supabase');
  await page.waitForTimeout(5000);

  await page.getByTestId('nav-dashboard').click();
  await page.waitForURL('**/dashboard');
  await page.getByTestId('dashboard-view-history').click();
  await page.waitForURL('**/orders/history');
  await page.getByText('View Full History', { exact: true }).waitFor({ state: 'visible' }).catch(() => {});

  await page.getByTestId('nav-kitchen').click();
  await page.waitForURL('**/kitchen');
  await page.getByText('Live Ops Active', { exact: true }).waitFor({ state: 'visible' });

  await page.getByTestId('nav-settings').click();
  await page.waitForURL('**/settings');
  const storeModeToggle = page.getByTestId('store-mode-toggle');
  await storeModeToggle.click();
  await expectText(storeModeToggle, 'Test Mode');
  await storeModeToggle.click();
  await expectText(storeModeToggle, 'Open');

  console.log('Browser smoke test passed');
} finally {
  await cleanup();
  await browser.close();
  try {
    fs.unlinkSync(pngPath);
  } catch {
    // ignore
  }
}

async function expectText(locator, expected) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const text = await locator.textContent();
    if ((text ?? '').includes(expected)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Expected element text to contain "${expected}"`);
}
