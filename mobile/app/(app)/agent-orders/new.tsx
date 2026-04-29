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

  const isReturnOrder = orderType === 'RETURN_ORDER';
  const sourceInvoice = returnSources.find((entry) => entry.id === sourceSalesInvoiceId);

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
        body: {
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
        },
      });

      setSuccess('Order-i u krijua me sukses.');
      router.replace(`/agent-orders/${created.id}` as any);
    } catch (nextError) {
      setError(parseApiError(nextError));
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

      <SectionCard title="Rreshtat" subtitle="Shto artikujt dhe sasitë e porosisë.">
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

        <Button
          label="Shto Rresht"
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
