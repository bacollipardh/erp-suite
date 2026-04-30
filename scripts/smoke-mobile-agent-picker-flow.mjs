const apiBaseUrl = process.env.ERP_API_BASE_URL || 'http://localhost:3000/api';
const adminEmail = process.env.ERP_ADMIN_EMAIL || 'admin@erp.local';
const adminPassword = process.env.ERP_ADMIN_PASSWORD || 'Admin123!';
const pickerEmail = process.env.ERP_PICKER_EMAIL || 'picker@erp.local';
const customerCode = process.env.ERP_MOBILE_CUSTOMER_CODE || 'CUS-003';
const warehouseCode = process.env.ERP_MOBILE_WAREHOUSE_CODE || 'MAIN';
const itemCode = process.env.ERP_MOBILE_ITEM_CODE || 'USB-CABLE-001';
const happyQty = Number(process.env.ERP_MOBILE_QTY || 1);
const exceptionQty = Number(process.env.ERP_MOBILE_EXCEPTION_QTY || 2);

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function readError(response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
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
  if (response.status === 204) return null;
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

function numeric(value) {
  return Number(value ?? 0);
}

function availableQty(stock) {
  return numeric(stock.qtyOnHand) - numeric(stock.reservedQty) - numeric(stock.pickedQty);
}

async function login(email, password) {
  const result = await fetchJson(
    'auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    `login ${email}`,
  );
  if (!result?.accessToken) throw new Error(`Login for ${email} did not return token`);
  return {
    Authorization: `Bearer ${result.accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function loadSeedData(headers) {
  const [customers, warehouses, items, pickers, series, paymentMethods] = await Promise.all([
    fetchJson('customers?limit=500', { headers }, 'customers').then(unwrapList),
    fetchJson('warehouses?limit=500', { headers }, 'warehouses').then(unwrapList),
    fetchJson('items?limit=500', { headers }, 'items').then(unwrapList),
    fetchJson('agent-orders/pickers', { headers }, 'pickers').then(unwrapList),
    fetchJson('document-series?limit=500', { headers }, 'document series').then(unwrapList),
    fetchJson('payment-methods?limit=500', { headers }, 'payment methods').then(unwrapList),
  ]);

  return {
    customer: requireEntry(customers, (entry) => entry.code === customerCode, customerCode),
    warehouse: requireEntry(warehouses, (entry) => entry.code === warehouseCode, warehouseCode),
    item: requireEntry(items, (entry) => entry.code === itemCode, itemCode),
    picker: requireEntry(pickers, (entry) => entry.email === pickerEmail, pickerEmail),
    invoiceSeries: requireEntry(
      series,
      (entry) => entry.documentType === 'SALES_INVOICE' && entry.isActive !== false,
      'active SALES_INVOICE series',
    ),
    paymentMethod: requireEntry(paymentMethods, (entry) => entry.code === 'CASH', 'CASH payment method'),
  };
}

async function createAgentOrder(headers, data, qty, notes) {
  return fetchJson(
    'agent-orders',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderType: 'SALES_ORDER',
        customerId: data.customer.id,
        warehouseId: data.warehouse.id,
        docDate: today(),
        priority: 4,
        notes,
        lines: [
          {
            itemId: data.item.id,
            description: data.item.name,
            qty,
            unitPrice: Number(data.item.standardSalesPrice ?? 0),
            discountPercent: 0,
            taxPercent: Number(data.item.taxRate?.ratePercent ?? data.item.taxRate?.rate ?? 18),
          },
        ],
      }),
    },
    'create fresh mobile agent order',
  );
}

async function transitionOrder(headers, orderId, data) {
  await fetchJson(`agent-orders/${orderId}/submit`, { method: 'POST', headers, body: '{}' }, 'submit order');
  await fetchJson(`agent-orders/${orderId}/approve`, { method: 'POST', headers, body: '{}' }, 'approve order');
  await fetchJson(
    `agent-orders/${orderId}/assign`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        assignedPickerId: data.picker.id,
        notes: 'Smoke mobile assignment',
      }),
    },
    'assign picker',
  );
  await fetchJson(`agent-orders/${orderId}/start`, { method: 'POST', headers, body: '{}' }, 'start WMS');
}

async function getAgentOrder(headers, orderId) {
  return fetchJson(`agent-orders/${orderId}`, { headers }, 'agent order details');
}

async function findPickLocation(headers, task) {
  const balances = unwrapList(
    await fetchJson(
      `wms/balances?itemId=${encodeURIComponent(task.itemId)}&limit=50`,
      { headers },
      'WMS balances for task item',
    ),
  );
  const stock = requireEntry(
    balances,
    (entry) => entry.location?.code && availableQty(entry) >= numeric(task.qty),
    `available WMS stock for task ${task.id}`,
  );
  return stock.location.barcode || stock.location.code;
}

async function pickAllTasks(headers, orderId) {
  const order = await getAgentOrder(headers, orderId);
  const pickTasks = unwrapList(order.tasks).filter((task) => task.taskType === 'PICK');
  if (!pickTasks.length) throw new Error('Expected agent order to have PICK tasks');

  const results = [];
  for (const task of pickTasks) {
    const detail = await fetchJson(`wms/tasks/${task.id}`, { headers }, `task detail ${task.id}`);
    const locationCode = await findPickLocation(headers, detail);
    const itemScan = detail.item?.barcode || detail.item?.code || itemCode;
    const picked = await fetchJson(
      `wms/tasks/${task.id}/pick-confirm`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          locationCode,
          itemCode: itemScan,
          qty: numeric(detail.qty),
          lotCode: detail.lotCode ?? undefined,
          serialNo: detail.serialNo ?? undefined,
          expiryDate: detail.expiryDate ? new Date(detail.expiryDate).toISOString().slice(0, 10) : undefined,
          notes: 'Smoke mobile picker confirm',
        }),
      },
      `pick confirm ${task.id}`,
    );

    const after = await fetchJson(`wms/tasks/${task.id}`, { headers }, `task detail after pick ${task.id}`);
    if (after.status !== 'DONE') {
      throw new Error(`Expected task ${task.id} to be DONE after pick, got ${after.status}`);
    }
    if (!after.auditTrail?.some((entry) => entry.action === 'PICK_CONFIRM')) {
      throw new Error(`Expected task ${task.id} audit trail to include PICK_CONFIRM`);
    }
    results.push({ taskId: task.id, pickedQty: picked.pickedQty, locationCode });
  }

  return results;
}

async function runHappyPath(headers, data) {
  const created = await createAgentOrder(
    headers,
    data,
    happyQty,
    `Smoke mobile happy path ${Date.now()}`,
  );
  await transitionOrder(headers, created.id, data);

  const assigned = await getAgentOrder(headers, created.id);
  if (!assigned.timeline?.length || !assigned.customerSnapshot || !assigned.documentReadiness) {
    throw new Error('Expected agent order detail to include timeline, customerSnapshot and documentReadiness');
  }

  const pickedTasks = await pickAllTasks(headers, created.id);

  const completed = await fetchJson(
    `agent-orders/${created.id}/complete-wms`,
    { method: 'POST', headers, body: '{}' },
    'complete agent WMS',
  );
  if (completed.status !== 'READY_FOR_DOCUMENT') {
    throw new Error(`Expected READY_FOR_DOCUMENT after complete WMS, got ${completed.status}`);
  }

  const ready = await getAgentOrder(headers, created.id);
  if (!ready.documentReadiness?.canCreateDocument) {
    throw new Error('Expected documentReadiness.canCreateDocument to be true');
  }

  const document = await fetchJson(
    `agent-orders/${created.id}/create-sales-invoice`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        seriesId: data.invoiceSeries.id,
        paymentMethodId: data.paymentMethod.id,
        postImmediately: true,
        notes: 'Smoke mobile Agent -> Picker -> Invoice',
      }),
    },
    'create posted sales invoice from agent order',
  );
  if (!document.posted || document.postWarning) {
    throw new Error(`Expected posted invoice, posted=${document.posted}; warning=${document.postWarning ?? '-'}`);
  }

  const invoice = await fetchJson(
    `sales-invoices/${document.salesInvoice.id}`,
    { headers },
    'created invoice details',
  );
  if (invoice.status !== 'POSTED') {
    throw new Error(`Expected created invoice to be POSTED, got ${invoice.status}`);
  }

  return {
    orderNo: created.orderNo,
    orderStatus: document.order.status,
    invoiceNo: invoice.docNo,
    invoiceStatus: invoice.status,
    pickedTasks,
    timelineCount: ready.timeline?.length ?? 0,
    outstandingAmount: ready.customerSnapshot?.outstandingAmount ?? null,
  };
}

async function runExceptionPath(headers, data) {
  const created = await createAgentOrder(
    headers,
    data,
    exceptionQty,
    `Smoke mobile exception path ${Date.now()}`,
  );
  await transitionOrder(headers, created.id, data);

  const order = await getAgentOrder(headers, created.id);
  const task = requireEntry(unwrapList(order.tasks), (entry) => entry.taskType === 'PICK', 'PICK task for exception path');
  const shortQty = Math.max(1, Math.min(1, numeric(task.qty)));

  const shorted = await fetchJson(
    `wms/tasks/${task.id}/short`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        shortQty,
        reasonCode: 'NO_STOCK',
        notes: 'Smoke mobile short exception',
      }),
    },
    'register short on mobile task',
  );
  if (!['BLOCKED', 'SHORT'].includes(shorted.status)) {
    throw new Error(`Expected short task to become BLOCKED or SHORT, got ${shorted.status}`);
  }

  const detail = await fetchJson(`wms/tasks/${task.id}`, { headers }, 'short task detail');
  if (!detail.auditTrail?.some((entry) => entry.action === 'SHORT')) {
    throw new Error('Expected short task audit trail to include SHORT');
  }

  await fetchJson(
    `wms/tasks/${task.id}/reassign`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        assignedToId: data.picker.id,
        notes: 'Smoke mobile supervisor reassign',
      }),
    },
    'supervisor reassign task',
  );

  return {
    orderNo: created.orderNo,
    taskId: task.id,
    resultingStatus: shorted.status,
    shortQty,
    auditActions: detail.auditTrail.map((entry) => entry.action),
  };
}

async function main() {
  await expectOk(await fetch(`${apiBaseUrl}/health`), 'health check');

  const headers = await login(adminEmail, adminPassword);
  const data = await loadSeedData(headers);

  const happyPath = await runHappyPath(headers, data);
  const exceptionPath = await runExceptionPath(headers, data);

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        customer: data.customer.code,
        warehouse: data.warehouse.code,
        item: data.item.code,
        picker: data.picker.email,
        happyPath,
        exceptionPath,
      },
      null,
      2,
    ),
  );
  console.log('Smoke mobile Agent -> Picker -> WMS -> Invoice flow passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
