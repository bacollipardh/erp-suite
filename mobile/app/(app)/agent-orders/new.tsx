import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Screen,
  SessionActions,
  SectionCard,
  TopTitle,
  uiStyles,
} from '../../../src/components/ui';
import { apiList, apiRequest } from '../../../src/lib/api';
import { formatNumber } from '../../../src/lib/format';
import {
  enqueueAgentOrderDraft,
  listQueuedAgentOrders,
  removeQueuedAgentOrder,
  replaceQueuedAgentOrders,
  type QueuedAgentOrderDraft,
} from '../../../src/lib/offline-queue';
import type {
  AgentOrder,
  Customer,
  CustomerObject,
  Item,
  ReturnSource,
  Warehouse,
} from '../../../src/types';
import { useAuth } from '../../../src/providers/auth-provider';

type DraftLine = {
  itemId: string;
  salesInvoiceLineId?: string;
  description: string;
  qty: string;
  unitPrice: string;
  discountPercent: string;
  taxPercent: string;
  notes: string;
  itemSearch: string;
};

const ORDER_TYPES = [
  { value: 'SALES_ORDER', label: 'Order shitje' },
  { value: 'RETURN_ORDER', label: 'Order kthimi' },
  { value: 'OPEN_RETURN_ORDER', label: 'Kthim pa afat' },
  { value: 'EXCHANGE_ORDER', label: 'Order ndërrimi' },
] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyLine(): DraftLine {
  return {
    itemId: '',
    salesInvoiceLineId: '',
    description: '',
    qty: '1',
    unitPrice: '0',
    discountPercent: '0',
    taxPercent: '18',
    notes: '',
    itemSearch: '',
  };
}

function matchesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search.trim().toLowerCase());
}

function parseApiError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Ruajtja dështoi.';
}

function optionTitle(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' | ');
}

export default function AgentOrderNewScreen() {
  const router = useRouter();
  const { apiUrl, token, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [queuedDrafts, setQueuedDrafts] = useState<QueuedAgentOrderDraft[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerObjects, setCustomerObjects] = useState<CustomerObject[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [returnSources, setReturnSources] = useState<ReturnSource[]>([]);

  const [orderType, setOrderType] = useState<string>('SALES_ORDER');
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerObjectId, setCustomerObjectId] = useState('');
  const [objectSearch, setObjectSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [sourceSalesInvoiceId, setSourceSalesInvoiceId] = useState('');
  const [sourceSearch, setSourceSearch] = useState('');
  const [docDate, setDocDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('5');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([createEmptyLine()]);
  const [quickItemSearch, setQuickItemSearch] = useState('');
  const [quickSelectedItemId, setQuickSelectedItemId] = useState('');
  const [quickQty, setQuickQty] = useState('1');
  const [quickDiscountPercent, setQuickDiscountPercent] = useState('0');
  const [showAdvancedLines, setShowAdvancedLines] = useState(false);

  const isReturnOrder = orderType === 'RETURN_ORDER';
  const sourceInvoice = returnSources.find((entry) => entry.id === sourceSalesInvoiceId);
  const quickSelectedItem = items.find((entry) => entry.id === quickSelectedItemId);

  const visibleCustomers = useMemo(
    () =>
      customers
        .filter((entry) => entry.isActive !== false)
        .filter((entry) =>
          !customerSearch
            ? true
            : matchesSearch(`${entry.code ?? ''} ${entry.name}`, customerSearch),
        )
        .slice(0, 12),
    [customerSearch, customers],
  );

  const visibleObjects = useMemo(
    () =>
      customerObjects
        .filter((entry) => entry.isActive !== false)
        .filter((entry) => !customerId || entry.customerId === customerId)
        .filter((entry) =>
          !objectSearch
            ? true
            : matchesSearch(`${entry.code ?? ''} ${entry.name}`, objectSearch),
        )
        .slice(0, 12),
    [customerId, customerObjects, objectSearch],
  );

  const visibleWarehouses = useMemo(
    () =>
      warehouses
        .filter((entry) => entry.isActive !== false)
        .filter((entry) =>
          !warehouseSearch
            ? true
            : matchesSearch(`${entry.code ?? ''} ${entry.name}`, warehouseSearch),
        )
        .slice(0, 12),
    [warehouseSearch, warehouses],
  );

  const visibleReturnSources = useMemo(
    () =>
      returnSources
        .filter((entry) => !customerId || entry.customerId === customerId)
        .filter((entry) =>
          !sourceSearch
            ? true
            : matchesSearch(
                `${entry.docNo} ${entry.customer?.name ?? ''} ${entry.warehouse?.name ?? ''}`,
                sourceSearch,
              ),
        )
        .slice(0, 12),
    [customerId, returnSources, sourceSearch],
  );

  const visibleQuickItems = useMemo(
    () =>
      items
        .filter((entry) => entry.isActive !== false)
        .filter((entry) =>
          !quickItemSearch
            ? true
            : matchesSearch(
                `${entry.code ?? ''} ${entry.name} ${entry.barcode ?? ''}`,
                quickItemSearch,
              ),
        )
        .slice(0, 10),
    [items, quickItemSearch],
  );

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        const qty = Number(line.qty || 0);
        const unitPrice = Number(line.unitPrice || 0);
        const discountPercent = Number(line.discountPercent || 0);
        const taxPercent = Number(line.taxPercent || 0);
        const base = qty * unitPrice;
        const discount = base * (discountPercent / 100);
        const net = base - discount;
        const tax = net * (taxPercent / 100);
        return {
          net: acc.net + net,
          tax: acc.tax + tax,
          total: acc.total + net + tax,
        };
      },
      { net: 0, tax: 0, total: 0 },
    );
  }, [lines]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [nextCustomers, nextObjects, nextWarehouses, nextItems, nextReturnSources] =
        await Promise.all([
          apiList<Customer>(apiUrl, '/customers', { token }),
          apiList<CustomerObject>(apiUrl, '/agent-orders/customer-objects', {
            token,
            query: { limit: 300 },
          }),
          apiList<Warehouse>(apiUrl, '/warehouses', { token }),
          apiList<Item>(apiUrl, '/items', { token }),
          apiList<ReturnSource>(apiUrl, '/agent-orders/return-sources', {
            token,
            query: { limit: 200 },
          }),
        ]);

      setCustomers(nextCustomers);
      setCustomerObjects(nextObjects);
      setWarehouses(nextWarehouses);
      setItems(nextItems);
      setReturnSources(nextReturnSources);
      setQueuedDrafts(await listQueuedAgentOrders());
    } catch (nextError) {
      setError(parseApiError(nextError));
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function chooseItem(index: number, item: Item) {
    updateLine(index, {
      itemId: item.id,
      description: item.name,
      unitPrice: String(Number(item.standardSalesPrice ?? 0)),
      taxPercent: String(Number(item.taxRate?.ratePercent ?? item.taxRate?.rate ?? 18)),
      itemSearch: '',
    });
  }

  function chooseSourceLine(index: number, sourceLineId: string) {
    const sourceLine = sourceInvoice?.lines.find((entry) => entry.id === sourceLineId);
    if (!sourceLine) return;
    updateLine(index, {
      salesInvoiceLineId: sourceLine.id,
      itemId: sourceLine.itemId,
      description: sourceLine.item?.name ?? '',
      qty: String(Number(sourceLine.qty ?? 1)),
      unitPrice: String(Number(sourceLine.unitPrice ?? 0)),
      taxPercent: String(Number(sourceLine.taxPercent ?? 0)),
    });
  }

  function addQuickLine() {
    const item = quickSelectedItem;
    if (!item) {
      setError('Zgjidh artikullin para se ta shtosh në order.');
      return;
    }
    const nextLine: DraftLine = {
      ...createEmptyLine(),
      itemId: item.id,
      description: item.name,
      qty: quickQty || '1',
      unitPrice: String(Number(item.standardSalesPrice ?? 0)),
      discountPercent: quickDiscountPercent || '0',
      taxPercent: String(Number(item.taxRate?.ratePercent ?? item.taxRate?.rate ?? 18)),
    };
    setLines((current) => {
      const hasOnlyEmptyLine =
        current.length === 1 &&
        !current[0].itemId &&
        !current[0].description &&
        Number(current[0].unitPrice || 0) === 0;
      return hasOnlyEmptyLine ? [nextLine] : [...current, nextLine];
    });
    setQuickItemSearch('');
    setQuickSelectedItemId('');
    setQuickQty('1');
    setQuickDiscountPercent('0');
    setSuccess(`${item.code ?? item.name} u shtua në order.`);
  }

  function duplicateLine(line: DraftLine) {
    setLines((current) => [...current, { ...line, itemSearch: '' }]);
  }

  function buildPayload() {
    return {
      orderType,
      customerId,
      customerObjectId: customerObjectId || undefined,
      warehouseId,
      sourceSalesInvoiceId: sourceSalesInvoiceId || undefined,
      docDate,
      dueDate: dueDate || undefined,
      priority: Number(priority || 5),
      notes: notes || undefined,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        salesInvoiceLineId: line.salesInvoiceLineId || undefined,
        description: line.description || undefined,
        qty: Number(line.qty),
        unitPrice: Number(line.unitPrice),
        discountPercent: Number(line.discountPercent || 0),
        taxPercent: Number(line.taxPercent || 0),
        notes: line.notes || undefined,
      })),
    };
  }

  async function saveDraftLocally() {
    if (!customerId || !warehouseId || !lines.some((line) => line.itemId)) {
      setError('Plotëso klientin, magazinën dhe së paku një rresht para ruajtjes lokale.');
      return;
    }

    const selectedCustomer = customers.find((entry) => entry.id === customerId);
    const selectedWarehouse = warehouses.find((entry) => entry.id === warehouseId);
    const queued = await enqueueAgentOrderDraft({
      summary: {
        customerName: selectedCustomer?.name,
        warehouseName: selectedWarehouse?.name,
        orderType,
        lineCount: lines.length,
        totalAmount: totals.total,
      },
      payload: buildPayload(),
    });
    setQueuedDrafts((current) => [queued, ...current].slice(0, 25));
    setSuccess('Draft-i u ruajt lokalisht dhe pret sync.');
  }

  async function syncQueuedDrafts() {
    if (!queuedDrafts.length) {
      setSuccess('Nuk ka draft-e në queue.');
      return;
    }
    setSyncingQueue(true);
    setError(null);
    try {
      const remaining: QueuedAgentOrderDraft[] = [];
      let synced = 0;
      for (const entry of queuedDrafts) {
        try {
          await apiRequest<AgentOrder>(apiUrl, '/agent-orders', {
            method: 'POST',
            token,
            body: entry.payload,
          });
          synced += 1;
        } catch {
          remaining.push(entry);
        }
      }
      await replaceQueuedAgentOrders(remaining);
      setQueuedDrafts(remaining);
      setSuccess(
        remaining.length
          ? `${synced} draft(e) u sinkronizuan. ${remaining.length} mbetën në queue.`
          : `${synced} draft(e) u sinkronizuan me sukses.`,
      );
    } catch (nextError) {
      setError(parseApiError(nextError));
    } finally {
      setSyncingQueue(false);
    }
  }

  async function submit() {
    setError(null);
    setSuccess(null);

    if (!customerId || !warehouseId) {
      setError('Zgjidh klientin dhe magazinën.');
      return;
    }
    if (isReturnOrder && !sourceSalesInvoiceId) {
      setError('Për order kthimi duhet fatura burim.');
      return;
    }

    const invalidLineIndex = lines.findIndex(
      (line) => !line.itemId || Number(line.qty) <= 0,
    );
    if (invalidLineIndex !== -1) {
      setError(`Rreshti ${invalidLineIndex + 1} nuk është plotësuar si duhet.`);
      return;
    }

    if (
      isReturnOrder &&
      lines.some((line) => !line.salesInvoiceLineId)
    ) {
      setError('Çdo rresht kthimi duhet të lidhet me një rresht nga fatura burim.');
      return;
    }

    setSaving(true);
    try {
      const created = await apiRequest<AgentOrder>(apiUrl, '/agent-orders', {
        method: 'POST',
        token,
        body: buildPayload(),
      });

      setSuccess('Order-i u krijua me sukses.');
      router.replace(`/agent-orders/${created.id}` as any);
    } catch (nextError) {
      setError(`${parseApiError(nextError)} Ruaje lokalisht nëse je pa lidhje dhe sinkronizoje më vonë.`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Duke ngarkuar të dhënat për order të ri..." />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <TopTitle
        title="Order i Ri"
        subtitle="Krijo porosi të re të agjentit direkt nga telefoni."
      />

      <SessionActions onHome={() => router.push('/home')} onLogout={() => void logout()} />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {success ? (
        <SectionCard title="U ruajt">
          <Text style={{ color: '#0F9D58' }}>{success}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title="Queue Lokale" subtitle="Ruaj draft-et në telefon dhe dërgoji kur lidhja është stabile.">
        <View style={uiStyles.wrapRow}>
          <Button label="Ruaj Draft Lokal" variant="secondary" onPress={() => void saveDraftLocally()} />
          <Button
            label={`Sinkronizo Queue (${queuedDrafts.length})`}
            loading={syncingQueue}
            onPress={() => void syncQueuedDrafts()}
          />
        </View>
        {queuedDrafts.length ? (
          <View style={{ gap: 8 }}>
            {queuedDrafts.slice(0, 5).map((entry) => (
              <View
                key={entry.id}
                style={{
                  borderWidth: 1,
                  borderColor: '#D8E0EA',
                  borderRadius: 14,
                  padding: 12,
                  gap: 6,
                }}
              >
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                  {entry.summary.customerName ?? 'Klient i panjohur'} | {entry.summary.orderType}
                </Text>
                <Text style={{ color: '#475569' }}>
                  {entry.summary.warehouseName ?? '-'} | {entry.summary.lineCount} rreshta | {formatNumber(entry.summary.totalAmount ?? 0)} EUR
                </Text>
                <Text style={{ color: '#64748B', fontSize: 12 }}>
                  {entry.createdAt}
                </Text>
                <Button
                  label="Hiqe Draft-in"
                  variant="ghost"
                  onPress={() =>
                    void (async () => {
                      await removeQueuedAgentOrder(entry.id);
                      setQueuedDrafts(await listQueuedAgentOrders());
                    })()
                  }
                />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="Nuk ka draft-e lokale" hint="Kur je pa internet ose s’do ta humbasësh punën, ruaje order-in këtu." />
        )}
      </SectionCard>

      <SectionCard title="Lloji i Order-it" subtitle="Zgjidh workflow-in që po hap agjenti.">
        <View style={uiStyles.wrapRow}>
          {ORDER_TYPES.map((entry) => (
            <Button
              key={entry.value}
              label={entry.label}
              variant={orderType === entry.value ? 'primary' : 'ghost'}
              onPress={() => {
                setOrderType(entry.value);
                if (entry.value !== 'RETURN_ORDER') {
                  setSourceSalesInvoiceId('');
                }
                if (entry.value !== 'RETURN_ORDER') {
                  setLines((current) =>
                    current.map((line) => ({ ...line, salesInvoiceLineId: '' })),
                  );
                }
              }}
            />
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Klienti" subtitle="Kërko dhe zgjidh blerësin.">
        <Input
          value={customerSearch}
          onChangeText={setCustomerSearch}
          placeholder="Kërko klient..."
        />
        <View style={{ gap: 8 }}>
          {visibleCustomers.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => {
                setCustomerId(entry.id);
                setCustomerObjectId('');
                if (sourceInvoice && sourceInvoice.customerId !== entry.id) {
                  setSourceSalesInvoiceId('');
                }
              }}
              style={{
                borderWidth: 1,
                borderColor: customerId === entry.id ? '#2553EB' : '#D8E0EA',
                backgroundColor: customerId === entry.id ? '#E8EEFF' : '#FFFFFF',
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                {optionTitle([entry.code ?? undefined, entry.name])}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Objekti" subtitle="Opsionale, nëse order-i lidhet me objekt.">
        <Input
          value={objectSearch}
          onChangeText={setObjectSearch}
          placeholder="Kërko objekt..."
        />
        {visibleObjects.length ? (
          <View style={{ gap: 8 }}>
            {visibleObjects.map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => setCustomerObjectId(entry.id)}
                style={{
                  borderWidth: 1,
                  borderColor: customerObjectId === entry.id ? '#2553EB' : '#D8E0EA',
                  backgroundColor: customerObjectId === entry.id ? '#E8EEFF' : '#FFFFFF',
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                  {optionTitle([entry.code ?? undefined, entry.name])}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState title="Nuk ka objekte për këtë klient" />
        )}
      </SectionCard>

      <SectionCard title="Magazina" subtitle="Magazina nga e cila do të procesohen rreshtat.">
        <Input
          value={warehouseSearch}
          onChangeText={setWarehouseSearch}
          placeholder="Kërko magazinë..."
        />
        <View style={{ gap: 8 }}>
          {visibleWarehouses.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => setWarehouseId(entry.id)}
              style={{
                borderWidth: 1,
                borderColor: warehouseId === entry.id ? '#2553EB' : '#D8E0EA',
                backgroundColor: warehouseId === entry.id ? '#E8EEFF' : '#FFFFFF',
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                {optionTitle([entry.code ?? undefined, entry.name])}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      {isReturnOrder ? (
        <SectionCard title="Fatura Burim" subtitle="Për order kthimi, lidhe me faturën e shitjes.">
          <Input
            value={sourceSearch}
            onChangeText={setSourceSearch}
            placeholder="Kërko faturë burim..."
          />
          <View style={{ gap: 8 }}>
            {visibleReturnSources.map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => setSourceSalesInvoiceId(entry.id)}
                style={{
                  borderWidth: 1,
                  borderColor: sourceSalesInvoiceId === entry.id ? '#2553EB' : '#D8E0EA',
                  backgroundColor: sourceSalesInvoiceId === entry.id ? '#E8EEFF' : '#FFFFFF',
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>{entry.docNo}</Text>
                <Text style={{ color: '#64748B', marginTop: 4 }}>
                  {entry.customer?.name ?? '-'} | {entry.warehouse?.name ?? '-'}
                </Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Detajet e Dokumentit">
        <Label>Data e order-it</Label>
        <Input value={docDate} onChangeText={setDocDate} placeholder="YYYY-MM-DD" />
        <Label>Afati</Label>
        <Input value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD (opsionale)" />
        <Label>Prioriteti (1-10)</Label>
        <Input value={priority} onChangeText={setPriority} keyboardType="numeric" />
        <Label>Shënime</Label>
        <Input value={notes} onChangeText={setNotes} placeholder="Opsionale" multiline />
      </SectionCard>

      {!isReturnOrder ? (
        <SectionCard title="Shto Artikull Shpejt" subtitle="Kërko artikullin, shkruaj sasinë dhe shtoje pa hapur formular të gjatë.">
          <Input
            value={quickItemSearch}
            onChangeText={(value) => {
              setQuickItemSearch(value);
              setQuickSelectedItemId('');
            }}
            placeholder="Kërko me kod, barkod ose emër..."
          />
          <View style={{ gap: 8 }}>
            {visibleQuickItems.map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => {
                  setQuickSelectedItemId(entry.id);
                  setQuickItemSearch(optionTitle([entry.code ?? undefined, entry.name]));
                }}
                style={{
                  borderWidth: 1,
                  borderColor: quickSelectedItemId === entry.id ? '#2553EB' : '#D8E0EA',
                  backgroundColor: quickSelectedItemId === entry.id ? '#E8EEFF' : '#FFFFFF',
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                  {optionTitle([entry.code ?? undefined, entry.name])}
                </Text>
                <Text style={{ color: '#64748B', marginTop: 4 }}>
                  Barkodi {entry.barcode ?? '-'} | Çmimi {formatNumber(entry.standardSalesPrice)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={uiStyles.row}>
            <View style={{ flex: 1 }}>
              <Label>Sasia</Label>
              <Input value={quickQty} onChangeText={setQuickQty} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Label>Discount %</Label>
              <Input
                value={quickDiscountPercent}
                onChangeText={setQuickDiscountPercent}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Button label="Shto në Order" onPress={addQuickLine} disabled={!quickSelectedItemId} />
        </SectionCard>
      ) : null}

      <SectionCard title="Rreshtat e Order-it" subtitle="Lista kompakte. Opsionet e avancuara hapen vetëm kur duhet çmim, TVSH ose shënim specifik.">
        {lines.some((line) => line.itemId) ? (
          <View style={{ gap: 10 }}>
            {lines.map((line, index) => {
              const lineItem = items.find((entry) => entry.id === line.itemId);
              const lineTotal =
                Number(line.qty || 0) *
                Number(line.unitPrice || 0) *
                (1 - Number(line.discountPercent || 0) / 100) *
                (1 + Number(line.taxPercent || 0) / 100);
              return (
                <View
                  key={index}
                  style={{
                    borderWidth: 1,
                    borderColor: '#D8E0EA',
                    borderRadius: 14,
                    padding: 12,
                    gap: 10,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                    {lineItem?.code ?? `Rreshti ${index + 1}`} | {line.description || lineItem?.name || '-'}
                  </Text>
                  <Text style={{ color: '#475569' }}>
                    Qty {line.qty || 0} | Çmimi {formatNumber(line.unitPrice)} | Total {formatNumber(lineTotal)} EUR
                  </Text>
                  <View style={uiStyles.wrapRow}>
                    <Button
                      label="-1"
                      variant="ghost"
                      onPress={() =>
                        updateLine(index, {
                          qty: String(Math.max(1, Number(line.qty || 1) - 1)),
                        })
                      }
                    />
                    <Button
                      label="+1"
                      variant="ghost"
                      onPress={() =>
                        updateLine(index, {
                          qty: String(Number(line.qty || 0) + 1),
                        })
                      }
                    />
                    <Button
                      label="Dyfisho"
                      variant="ghost"
                      onPress={() => duplicateLine(line)}
                    />
                    <Button
                      label="Hiq"
                      variant="danger"
                      disabled={lines.length === 1}
                      onPress={() =>
                        setLines((current) =>
                          current.filter((_, currentIndex) => currentIndex !== index),
                        )
                      }
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState title="Shto artikullin e parë" hint="Përdor kërkimin e shpejtë sipër dhe order-i ndërtohet si listë e thjeshtë." />
        )}

        <Button
          label={showAdvancedLines ? 'Mbyll Opsionet e Avancuara' : 'Hap Opsionet e Avancuara'}
          variant="secondary"
          onPress={() => setShowAdvancedLines((current) => !current)}
        />

        {showAdvancedLines || isReturnOrder ? (
          <View style={{ gap: 14 }}>
            {lines.map((line, index) => {
            const filteredItems = items
              .filter((entry) => entry.isActive !== false)
              .filter((entry) =>
                !line.itemSearch
                  ? true
                  : matchesSearch(
                      `${entry.code ?? ''} ${entry.name} ${entry.barcode ?? ''}`,
                      line.itemSearch,
                    ),
              )
              .slice(0, 8);

            return (
              <View
                key={index}
                style={{
                  borderWidth: 1,
                  borderColor: '#D8E0EA',
                  borderRadius: 16,
                  padding: 12,
                  gap: 10,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                  Rreshti {index + 1}
                </Text>

                {isReturnOrder && sourceInvoice ? (
                  <View style={{ gap: 8 }}>
                    <Label>Rreshti burim</Label>
                    {sourceInvoice.lines.map((sourceLine) => (
                      <Pressable
                        key={sourceLine.id}
                        onPress={() => chooseSourceLine(index, sourceLine.id)}
                        style={{
                          borderWidth: 1,
                          borderColor:
                            line.salesInvoiceLineId === sourceLine.id ? '#2553EB' : '#D8E0EA',
                          backgroundColor:
                            line.salesInvoiceLineId === sourceLine.id ? '#E8EEFF' : '#FFFFFF',
                          borderRadius: 12,
                          padding: 10,
                        }}
                      >
                        <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                          {optionTitle([
                            sourceLine.item?.code ?? undefined,
                            sourceLine.item?.name ?? sourceLine.itemId,
                          ])}
                        </Text>
                        <Text style={{ color: '#64748B', marginTop: 4 }}>
                          Qty {Number(sourceLine.qty)} | Çmimi {formatNumber(sourceLine.unitPrice)} | TVSH{' '}
                          {Number(sourceLine.taxPercent)}%
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <>
                    <Label>Artikulli</Label>
                    <Input
                      value={line.itemSearch}
                      onChangeText={(value) => updateLine(index, { itemSearch: value })}
                      placeholder="Kërko artikull..."
                    />
                    <View style={{ gap: 8 }}>
                      {filteredItems.map((entry) => (
                        <Pressable
                          key={entry.id}
                          onPress={() => chooseItem(index, entry)}
                          style={{
                            borderWidth: 1,
                            borderColor: line.itemId === entry.id ? '#2553EB' : '#D8E0EA',
                            backgroundColor: line.itemId === entry.id ? '#E8EEFF' : '#FFFFFF',
                            borderRadius: 12,
                            padding: 10,
                          }}
                        >
                          <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                            {optionTitle([entry.code ?? undefined, entry.name])}
                          </Text>
                          <Text style={{ color: '#64748B', marginTop: 4 }}>
                            Barkodi {entry.barcode ?? '-'} | Çmimi {formatNumber(entry.standardSalesPrice)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                <Label>Përshkrimi</Label>
                <Input
                  value={line.description}
                  onChangeText={(value) => updateLine(index, { description: value })}
                  placeholder="Përshkrimi i rreshtit"
                />
                <View style={uiStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Label>Sasia</Label>
                    <Input
                      value={line.qty}
                      onChangeText={(value) => updateLine(index, { qty: value })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label>Çmimi</Label>
                    <Input
                      value={line.unitPrice}
                      onChangeText={(value) => updateLine(index, { unitPrice: value })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={uiStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Label>Discount %</Label>
                    <Input
                      value={line.discountPercent}
                      onChangeText={(value) => updateLine(index, { discountPercent: value })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label>TVSH %</Label>
                    <Input
                      value={line.taxPercent}
                      onChangeText={(value) => updateLine(index, { taxPercent: value })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <Label>Shënime</Label>
                <Input
                  value={line.notes}
                  onChangeText={(value) => updateLine(index, { notes: value })}
                  placeholder="Opsionale"
                />
                <Button
                  label="Hiq Rreshtin"
                  variant="danger"
                  disabled={lines.length === 1}
                  onPress={() =>
                    setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))
                  }
                />
              </View>
            );
            })}
          </View>
        ) : null}

        <Button
          label="Shto Rresht Bosh"
          variant="secondary"
          onPress={() => setLines((current) => [...current, createEmptyLine()])}
        />

        <View style={{ gap: 4 }}>
          <Text style={{ color: '#475569' }}>Neto: {formatNumber(totals.net)} EUR</Text>
          <Text style={{ color: '#475569' }}>TVSH: {formatNumber(totals.tax)} EUR</Text>
          <Text style={{ color: '#0F172A', fontWeight: '700' }}>
            Total: {formatNumber(totals.total)} EUR
          </Text>
        </View>
      </SectionCard>

      <Button
        label={saving ? 'Duke ruajtur...' : 'Krijo Order-in'}
        disabled={saving}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
