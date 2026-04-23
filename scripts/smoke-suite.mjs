const apiBaseUrl = process.env.ERP_API_BASE_URL || 'http://localhost:3000/api';
const frontendBaseUrl = process.env.ERP_FRONTEND_BASE_URL || 'http://localhost:3001';
const email = process.env.ERP_ADMIN_EMAIL || 'admin@erp.local';
const password = process.env.ERP_ADMIN_PASSWORD || 'Admin123!';

function today() {
  return new Date().toISOString().slice(0, 10);
}

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

async function fetchJson(url, options, label) {
  const response = await expectOk(await fetch(url, options), label);
  return response.json();
}

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  throw new Error('Unexpected list payload');
}

function requireEntry(entries, predicate, label) {
  const entry = entries.find(predicate);
  if (!entry) {
    throw new Error(`Missing required seed data: ${label}`);
  }
  return entry;
}

async function main() {
  await expectOk(await fetch(`${apiBaseUrl}/health`), 'health check');

  const login = await fetchJson(
    `${apiBaseUrl}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    'backend login',
  );

  if (!login?.accessToken) {
    throw new Error('backend login did not return an access token');
  }

  const authHeaders = {
    Authorization: `Bearer ${login.accessToken}`,
    'Content-Type': 'application/json',
  };

  await fetchJson(`${apiBaseUrl}/auth/me`, { headers: authHeaders }, 'auth/me');

  const [seriesPayload, customersPayload, suppliersPayload, warehousesPayload, itemsPayload, paymentMethodsPayload] =
    await Promise.all([
      fetchJson(`${apiBaseUrl}/document-series`, { headers: authHeaders }, 'document series'),
      fetchJson(`${apiBaseUrl}/customers`, { headers: authHeaders }, 'customers'),
      fetchJson(`${apiBaseUrl}/suppliers`, { headers: authHeaders }, 'suppliers'),
      fetchJson(`${apiBaseUrl}/warehouses`, { headers: authHeaders }, 'warehouses'),
      fetchJson(`${apiBaseUrl}/items`, { headers: authHeaders }, 'items'),
      fetchJson(`${apiBaseUrl}/payment-methods`, { headers: authHeaders }, 'payment methods'),
    ]);

  const series = unwrapList(seriesPayload);
  const customers = unwrapList(customersPayload);
  const suppliers = unwrapList(suppliersPayload);
  const warehouses = unwrapList(warehousesPayload);
  const items = unwrapList(itemsPayload);
  const paymentMethods = unwrapList(paymentMethodsPayload);

  if (warehouses.length < 2) {
    throw new Error('Smoke suite requires at least two warehouses');
  }

  const purchaseSeries = requireEntry(series, (entry) => entry.documentType === 'PURCHASE_INVOICE', 'purchase series');
  const salesSeries = requireEntry(series, (entry) => entry.documentType === 'SALES_INVOICE', 'sales series');
  const returnSeries = requireEntry(series, (entry) => entry.documentType === 'SALES_RETURN', 'return series');
  const customer = requireEntry(customers, () => true, 'customer');
  const supplier = requireEntry(suppliers, () => true, 'supplier');
  const mainWarehouse = requireEntry(warehouses, () => true, 'main warehouse');
  const secondaryWarehouse = requireEntry(warehouses, (entry) => entry.id !== mainWarehouse.id, 'secondary warehouse');
  const item = requireEntry(items, () => true, 'item');
  const paymentMethod = requireEntry(paymentMethods, () => true, 'payment method');
  const date = today();

  const purchaseInvoice = await fetchJson(
    `${apiBaseUrl}/purchase-invoices`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        seriesId: purchaseSeries.id,
        supplierId: supplier.id,
        warehouseId: mainWarehouse.id,
        docDate: date,
        dueDate: date,
        supplierInvoiceNo: `SMOKE-P-${Date.now()}`,
        notes: 'Smoke suite purchase invoice',
        lines: [
          {
            itemId: item.id,
            qty: 3,
            unitPrice: 100,
            discountPercent: 0,
            taxPercent: 18,
          },
        ],
      }),
    },
    'create purchase invoice',
  );

  await fetchJson(
    `${apiBaseUrl}/purchase-invoices/${purchaseInvoice.id}/post`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    },
    'post purchase invoice',
  );

  const paidPurchase = await fetchJson(
    `${apiBaseUrl}/purchase-invoices/${purchaseInvoice.id}/payments`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        amount: 75,
        paidAt: date,
        referenceNo: `PAY-P-${Date.now()}`,
      }),
    },
    'record purchase payment',
  );

  if (!['PARTIALLY_PAID', 'PAID'].includes(paidPurchase.paymentStatus)) {
    throw new Error('purchase payment status was not updated');
  }

  const salesInvoice = await fetchJson(
    `${apiBaseUrl}/sales-invoices`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        seriesId: salesSeries.id,
        customerId: customer.id,
        warehouseId: mainWarehouse.id,
        paymentMethodId: paymentMethod.id,
        docDate: date,
        dueDate: date,
        notes: 'Smoke suite sales invoice',
        lines: [
          {
            itemId: item.id,
            qty: 1,
            unitPrice: 150,
            discountPercent: 0,
            taxPercent: 18,
          },
        ],
      }),
    },
    'create sales invoice',
  );

  await fetchJson(
    `${apiBaseUrl}/sales-invoices/${salesInvoice.id}/post`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    },
    'post sales invoice',
  );

  const paidSales = await fetchJson(
    `${apiBaseUrl}/sales-invoices/${salesInvoice.id}/payments`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        amount: 50,
        paidAt: date,
        referenceNo: `PAY-S-${Date.now()}`,
      }),
    },
    'record sales payment',
  );

  if (!['PARTIALLY_PAID', 'PAID'].includes(paidSales.paymentStatus)) {
    throw new Error('sales payment status was not updated');
  }

  const salesInvoiceDetail = await fetchJson(
    `${apiBaseUrl}/sales-invoices/${salesInvoice.id}`,
    { headers: authHeaders },
    'sales invoice detail',
  );

  const sourceLine = requireEntry(salesInvoiceDetail.lines ?? [], () => true, 'sales invoice line');

  const salesReturn = await fetchJson(
    `${apiBaseUrl}/sales-returns`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        seriesId: returnSeries.id,
        salesInvoiceId: salesInvoice.id,
        customerId: customer.id,
        docDate: date,
        reason: 'Smoke suite return',
        notes: 'Smoke suite sales return',
        lines: [
          {
            salesInvoiceLineId: sourceLine.id,
            itemId: sourceLine.itemId,
            qty: 1,
            unitPrice: Number(sourceLine.unitPrice),
            taxPercent: Number(sourceLine.taxPercent),
          },
        ],
      }),
    },
    'create sales return',
  );

  await fetchJson(
    `${apiBaseUrl}/sales-returns/${salesReturn.id}/post`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    },
    'post sales return',
  );

  await fetchJson(
    `${apiBaseUrl}/stock/adjustments`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        warehouseId: mainWarehouse.id,
        itemId: item.id,
        qtyChange: 2,
        referenceNo: `ADJ-${Date.now()}`,
        reason: 'Smoke suite adjustment',
      }),
    },
    'stock adjustment',
  );

  await fetchJson(
    `${apiBaseUrl}/stock/transfers`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        fromWarehouseId: mainWarehouse.id,
        toWarehouseId: secondaryWarehouse.id,
        itemId: item.id,
        qty: 1,
        referenceNo: `TRF-${Date.now()}`,
        notes: 'Smoke suite transfer',
      }),
    },
    'stock transfer',
  );

  const balancePayload = await fetchJson(
    `${apiBaseUrl}/stock/balance?warehouseId=${secondaryWarehouse.id}&itemId=${item.id}&limit=5`,
    { headers: authHeaders },
    'stock balance',
  );

  const secondaryBalance = requireEntry(unwrapList(balancePayload), () => true, 'secondary stock balance');

  await fetchJson(
    `${apiBaseUrl}/stock/counts`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        warehouseId: secondaryWarehouse.id,
        itemId: item.id,
        countedQty: Number(secondaryBalance.qtyOnHand),
        referenceNo: `CNT-${Date.now()}`,
        notes: 'Smoke suite count',
      }),
    },
    'stock count',
  );

  await fetchJson(
    `${apiBaseUrl}/fiscalization/sales-invoices/${salesInvoice.id}/submit`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    },
    'fiscalize sales invoice',
  );

  await fetchJson(
    `${apiBaseUrl}/fiscalization/sales-returns/${salesReturn.id}/submit`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    },
    'fiscalize sales return',
  );

  await Promise.all([
    fetchJson(`${apiBaseUrl}/dashboard/summary`, { headers: authHeaders }, 'dashboard summary'),
    fetchJson(`${apiBaseUrl}/reports/sales-summary?limitRecent=20`, { headers: authHeaders }, 'sales summary'),
    fetchJson(`${apiBaseUrl}/reports/receivables-aging?limit=20`, { headers: authHeaders }, 'receivables aging'),
    fetchJson(`${apiBaseUrl}/reports/payables-aging?limit=20`, { headers: authHeaders }, 'payables aging'),
    fetchJson(`${apiBaseUrl}/accounting/accounts?limit=20`, { headers: authHeaders }, 'accounting accounts'),
    fetchJson(
      `${apiBaseUrl}/accounting/journal-entries?limit=20`,
      { headers: authHeaders },
      'accounting journal entries',
    ),
    fetchJson(
      `${apiBaseUrl}/accounting/trial-balance?asOfDate=${date}`,
      { headers: authHeaders },
      'trial balance',
    ),
    fetchJson(
      `${apiBaseUrl}/accounting/profit-loss?dateFrom=${date}&dateTo=${date}`,
      { headers: authHeaders },
      'profit and loss',
    ),
    fetchJson(
      `${apiBaseUrl}/accounting/balance-sheet?asOfDate=${date}`,
      { headers: authHeaders },
      'balance sheet',
    ),
    fetchJson(`${apiBaseUrl}/audit-logs?limit=20`, { headers: authHeaders }, 'audit logs'),
    fetchJson(`${apiBaseUrl}/stock/movements?limit=20`, { headers: authHeaders }, 'stock movements'),
  ]);

  const frontendLoginResponse = await expectOk(
    await fetch(`${frontendBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
    'frontend login',
  );

  const setCookie = frontendLoginResponse.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('frontend login did not return a session cookie');
  }

  const cookieHeader = setCookie.split(';')[0];
  await frontendLoginResponse.json();

  await fetchJson(
    `${frontendBaseUrl}/api/auth/session`,
    {
      headers: { Cookie: cookieHeader },
    },
    'frontend session',
  ).then((session) => {
    if (!session?.user?.id || !Array.isArray(session?.user?.permissions) || typeof session?.user?.role !== 'string') {
      throw new Error('frontend session did not return the expected user payload');
    }
  });

  await fetchJson(
    `${frontendBaseUrl}/api/proxy/dashboard/summary`,
    {
      headers: { Cookie: cookieHeader },
    },
    'frontend proxy dashboard',
  );

  const frontendDocumentPage = await expectOk(
    await fetch(`${frontendBaseUrl}/sales-invoices/${salesInvoice.id}`, {
      headers: { Cookie: cookieHeader },
      redirect: 'manual',
    }),
    'frontend sales invoice page',
  );

  const documentHtml = await frontendDocumentPage.text();
  if (!documentHtml.includes(salesInvoice.docNo)) {
    throw new Error('frontend sales invoice page did not include the expected document number');
  }

  await Promise.all([
    expectOk(
      await fetch(`${frontendBaseUrl}/financa/libri-kontabel`, {
        headers: { Cookie: cookieHeader },
        redirect: 'manual',
      }),
      'frontend accounting ledger page',
    ),
    expectOk(
      await fetch(`${frontendBaseUrl}/raportet/kontabiliteti`, {
        headers: { Cookie: cookieHeader },
        redirect: 'manual',
      }),
      'frontend accounting reports page',
    ),
  ]);

  await expectOk(
    await fetch(`${frontendBaseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieHeader },
    }),
    'frontend logout',
  );

  console.log('Smoke suite passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
