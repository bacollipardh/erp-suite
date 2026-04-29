const apiBaseUrl = process.env.ERP_API_BASE_URL || 'http://localhost:3000/api';
const email = process.env.ERP_ADMIN_EMAIL || 'admin@erp.local';
const password = process.env.ERP_ADMIN_PASSWORD || 'Admin123!';
const orderNo = process.env.ERP_AGENT_ORDER_NO || 'AO-DEMO-0001';
const pickerEmail = process.env.ERP_PICKER_EMAIL || 'picker@erp.local';

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

  const orders = unwrapList(
    await fetchJson('agent-orders?limit=100', { headers }, 'agent orders'),
  );
  const order = requireEntry(orders, (entry) => entry.orderNo === orderNo, orderNo);
  if (!['SUBMITTED', 'APPROVED'].includes(order.status)) {
    throw new Error(
      `${orderNo} is ${order.status}. Run the demo seed first to reset it before this smoke test.`,
    );
  }

  const pickers = unwrapList(await fetchJson('agent-orders/pickers', { headers }, 'pickers'));
  const picker = requireEntry(pickers, (entry) => entry.email === pickerEmail, pickerEmail);

  await fetchJson(
    `agent-orders/${order.id}/assign`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        assignedPickerId: picker.id,
        notes: 'Smoke Agent -> WMS assignment',
      }),
    },
    'assign picker',
  );

  await fetchJson(
    `agent-orders/${order.id}/start`,
    { method: 'POST', headers, body: JSON.stringify({}) },
    'start WMS',
  );

  await fetchJson(
    `agent-orders/${order.id}/complete-wms`,
    { method: 'POST', headers, body: JSON.stringify({}) },
    'complete WMS',
  );

  const series = unwrapList(await fetchJson('document-series', { headers }, 'document series'));
  const invoiceSeries = requireEntry(
    series,
    (entry) => entry.documentType === 'SALES_INVOICE' && entry.isActive !== false,
    'active SALES_INVOICE series',
  );
  const paymentMethods = unwrapList(
    await fetchJson('payment-methods', { headers }, 'payment methods'),
  );
  const paymentMethod = requireEntry(paymentMethods, (entry) => entry.code === 'CASH', 'CASH');

  const created = await fetchJson(
    `agent-orders/${order.id}/create-sales-invoice`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        seriesId: invoiceSeries.id,
        paymentMethodId: paymentMethod.id,
        postImmediately: true,
        notes: 'Smoke Agent -> WMS -> posted invoice',
      }),
    },
    'create and post sales invoice',
  );

  if (!created.posted || created.postWarning) {
    throw new Error(
      `Invoice was not posted. posted=${created.posted}; warning=${created.postWarning ?? '-'}`,
    );
  }

  const invoice = await fetchJson(
    `sales-invoices/${created.salesInvoice.id}`,
    { headers },
    'sales invoice details',
  );
  if (invoice.status !== 'POSTED') {
    throw new Error(`Expected invoice to be POSTED, got ${invoice.status}`);
  }

  const reservations = unwrapList(
    await fetchJson(
      `wms/reservations?sourceId=${encodeURIComponent(invoice.id)}&limit=100`,
      { headers },
      'WMS reservations',
    ),
  );
  if (!reservations.length || reservations.some((entry) => entry.status !== 'SHIPPED')) {
    throw new Error('Expected WMS reservations to be shipped');
  }

  const tasks = unwrapList(
    await fetchJson(
      `wms/tasks?search=${encodeURIComponent(invoice.docNo)}&limit=100`,
      { headers },
      'WMS tasks',
    ),
  );
  const openTasks = tasks.filter((entry) => ['PENDING', 'IN_PROGRESS', 'BLOCKED'].includes(entry.status));
  if (openTasks.length) {
    throw new Error(`Expected no open WMS tasks, found ${openTasks.length}`);
  }

  console.log(
    JSON.stringify(
      {
        orderNo,
        orderStatus: created.order.status,
        invoiceNo: invoice.docNo,
        invoiceStatus: invoice.status,
        wmsReservations: reservations.length,
        wmsTasks: tasks.map((entry) => `${entry.taskType}:${entry.status}`),
        grandTotal: invoice.grandTotal,
      },
      null,
      2,
    ),
  );
  console.log('Smoke Agent -> WMS -> posted invoice passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
