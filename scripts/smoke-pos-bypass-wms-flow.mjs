const apiBaseUrl = process.env.ERP_API_BASE_URL || 'http://localhost:3000/api';
const email = process.env.ERP_ADMIN_EMAIL || 'admin@erp.local';
const password = process.env.ERP_ADMIN_PASSWORD || 'Admin123!';
const customerCode = process.env.ERP_POS_CUSTOMER_CODE || 'CUS-003';
const warehouseCode = process.env.ERP_POS_WAREHOUSE_CODE || 'MAIN';
const itemCode = process.env.ERP_POS_ITEM_CODE || 'MOUSE-001';
const qty = Number(process.env.ERP_POS_QTY || 1);

async function readError(response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    return typeof parsed.message === 'string' ? parsed.message : text;
  } catch {
    return text;
  }
}

async function expectOk(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${await readError(response)}`);
  }
  return response;
}

async function fetchJson(path, options, label) {
  const response = await expectOk(await fetch(`${apiBaseUrl}/${path}`, options), label);
  return response.json();
}

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
}

function requireEntry(entries, predicate, label) {
  const entry = entries.find(predicate);
  if (!entry) throw new Error(`Missing required data: ${label}`);
  return entry;
}

async function main() {
  await expectOk(await fetch(`${apiBaseUrl}/health`), 'health check');

  const login = await fetchJson(
    'auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    'login',
  );
  if (!login?.accessToken) throw new Error('Login did not return access token');

  const headers = {
    Authorization: `Bearer ${login.accessToken}`,
    'Content-Type': 'application/json',
  };

  const [customers, warehouses, items, series, paymentMethods] = await Promise.all([
    fetchJson('customers?limit=500', { headers }, 'customers').then(unwrapList),
    fetchJson('warehouses?limit=500', { headers }, 'warehouses').then(unwrapList),
    fetchJson('items?limit=500', { headers }, 'items').then(unwrapList),
    fetchJson('document-series?limit=500', { headers }, 'document series').then(unwrapList),
    fetchJson('payment-methods?limit=500', { headers }, 'payment methods').then(unwrapList),
  ]);

  const customer = requireEntry(customers, (entry) => entry.code === customerCode, customerCode);
  const warehouse = requireEntry(warehouses, (entry) => entry.code === warehouseCode, warehouseCode);
  const item = requireEntry(items, (entry) => entry.code === itemCode, itemCode);
  const invoiceSeries = requireEntry(
    series,
    (entry) => entry.documentType === 'SALES_INVOICE' && entry.isActive !== false,
    'active SALES_INVOICE series',
  );
  const paymentMethod = requireEntry(paymentMethods, (entry) => entry.code === 'CASH', 'CASH');

  const invoice = await fetchJson(
    'sales-invoices',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        seriesId: invoiceSeries.id,
        customerId: customer.id,
        warehouseId: warehouse.id,
        paymentMethodId: paymentMethod.id,
        docDate: new Date().toISOString().slice(0, 10),
        notes: 'Smoke POS -> posted invoice without WMS workflow',
        lines: [
          {
            itemId: item.id,
            qty,
            unitPrice: Number(item.standardSalesPrice ?? 0),
            discountPercent: 0,
            taxPercent: Number(item.taxRate?.ratePercent ?? 18),
          },
        ],
      }),
    },
    'create POS bypass invoice',
  );

  const posted = await fetchJson(
    `sales-invoices/${invoice.id}/post`,
    { method: 'POST', headers, body: JSON.stringify({ skipWms: true }) },
    'post sales invoice without WMS workflow',
  );
  if (posted.status !== 'POSTED') {
    throw new Error(`Expected invoice to be POSTED, got ${posted.status}`);
  }

  const reservations = unwrapList(
    await fetchJson(
      `wms/reservations?sourceId=${encodeURIComponent(invoice.id)}&limit=100`,
      { headers },
      'WMS reservations',
    ),
  );
  if (!reservations.length || reservations.some((entry) => entry.status !== 'SHIPPED')) {
    throw new Error('Expected bypass WMS reservations to be shipped');
  }

  const tasks = unwrapList(
    await fetchJson(
      `wms/tasks?search=${encodeURIComponent(invoice.docNo)}&limit=100`,
      { headers },
      'WMS tasks',
    ),
  );
  if (tasks.some((entry) => ['PENDING', 'IN_PROGRESS', 'BLOCKED'].includes(entry.status))) {
    throw new Error('Expected bypass posting to leave no open WMS tasks');
  }

  console.log(
    JSON.stringify(
      {
        invoiceNo: posted.docNo,
        invoiceStatus: posted.status,
        customer: customer.code,
        warehouse: warehouse.code,
        item: item.code,
        qty,
        wmsMode: 'BYPASS',
        wmsReservations: reservations.length,
        wmsTasks: tasks.map((entry) => `${entry.taskType}:${entry.status}`),
        grandTotal: posted.grandTotal,
      },
      null,
      2,
    ),
  );
  console.log('Smoke POS -> posted invoice without WMS workflow passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
