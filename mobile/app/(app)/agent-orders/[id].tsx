import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  MetricTile,
  Screen,
  SectionCard,
  SessionActions,
  StatusBadge,
  TopTitle,
  uiStyles,
} from '../../../src/components/ui';
import { apiList, apiRequest } from '../../../src/lib/api';
import { formatDateOnly, formatDateTime, formatNumber, formatQty, sentenceStatus } from '../../../src/lib/format';
import {
  hasPermission,
  PERMISSIONS,
} from '../../../src/lib/permissions';
import type {
  AgentOrder,
  DocumentSeries,
  PaymentMethod,
  PickerOption,
} from '../../../src/types';
import { useAuth } from '../../../src/providers/auth-provider';

export default function AgentOrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiUrl, token, user, logout } = useAuth();
  const [order, setOrder] = useState<AgentOrder | null>(null);
  const [pickers, setPickers] = useState<PickerOption[]>([]);
  const [series, setSeries] = useState<DocumentSeries[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPickerId, setSelectedPickerId] = useState<string>('');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState('');
  const [documentNotes, setDocumentNotes] = useState('');
  const [returnReason, setReturnReason] = useState('');

  const canAssign = hasPermission(user, PERMISSIONS.agentOrdersAssign);
  const canManage = hasPermission(user, PERMISSIONS.agentOrdersManage);
  const isReturnOrder =
    order?.orderType === 'RETURN_ORDER' || order?.orderType === 'OPEN_RETURN_ORDER';

  const invoiceSeries = useMemo(
    () => series.filter((entry) => entry.documentType === 'SALES_INVOICE'),
    [series],
  );
  const returnSeries = useMemo(
    () => series.filter((entry) => entry.documentType === 'SALES_RETURN'),
    [series],
  );

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [nextOrder, nextPickers, nextSeries, nextPayments] = await Promise.all([
        apiRequest<AgentOrder>(apiUrl, `/agent-orders/${id}`, { token }),
        canAssign ? apiList<PickerOption>(apiUrl, '/agent-orders/pickers', { token }) : Promise.resolve([]),
        apiList<DocumentSeries>(apiUrl, '/document-series', {
          token,
          query: { limit: 200 },
        }),
        apiList<PaymentMethod>(apiUrl, '/payment-methods', {
          token,
          query: { limit: 200 },
        }),
      ]);

      setOrder(nextOrder);
      setPickers(nextPickers);
      setSeries(nextSeries);
      setPaymentMethods(nextPayments);
      setSelectedPickerId(nextOrder.assignedPickerId ?? nextPickers[0]?.id ?? '');
      const nextIsReturnOrder =
        nextOrder.orderType === 'RETURN_ORDER' ||
        nextOrder.orderType === 'OPEN_RETURN_ORDER';
      const nextSeriesOptions = nextSeries.filter(
        (entry) =>
          entry.documentType ===
          (nextIsReturnOrder ? 'SALES_RETURN' : 'SALES_INVOICE'),
      );
      setSelectedSeriesId(
        nextSeriesOptions[0]?.id ??
          nextSeries.find(
            (entry) =>
              entry.documentType ===
              (nextIsReturnOrder ? 'SALES_RETURN' : 'SALES_INVOICE'),
          )?.id ??
          '',
      );
      setSelectedPaymentMethodId(nextPayments[0]?.id ?? '');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, canAssign, id, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function runAction(key: string, runner: () => Promise<void>) {
    setActionLoading(key);
    setError(null);
    try {
      await runner();
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Duke ngarkuar order-in..." />
      </Screen>
    );
  }

  if (error && !order) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={() => void load()} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <EmptyState title="Order-i nuk u gjet" />
      </Screen>
    );
  }

  const lines = Array.isArray(order.lines) ? order.lines : [];
  const seriesOptions = isReturnOrder ? returnSeries : invoiceSeries;

  return (
    <Screen scroll>
      <TopTitle
        title={order.orderNo}
        subtitle={`${order.customer?.name ?? '-'}${order.customerObject?.name ? ` / ${order.customerObject.name}` : ''}`}
      />

      <SessionActions onHome={() => router.push('/home')} onLogout={() => void logout()} />

      {error ? <ErrorState message={error} /> : null}

      <SectionCard title="Gjendja Operative" subtitle={order.warehouse?.name ?? '-'}>
        <View style={uiStyles.wrapRow}>
          <StatusBadge value={order.status} />
          <StatusBadge value={order.orderType} />
        </View>
        <View style={uiStyles.wrapRow}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Label>Prioriteti</Label>
            <Text>{order.priority}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Label>Picker</Label>
            <Text>{order.assignedPicker?.fullName ?? '-'}</Text>
          </View>
        </View>
        <View style={uiStyles.wrapRow}>
          <MetricTile label="Rreshta" value={lines.length} />
          <MetricTile label="Task WMS" value={order.tasks?.length ?? 0} />
          <MetricTile label="Dokument" value={order.salesInvoice?.docNo ?? order.salesReturn?.docNo ?? '-'} />
        </View>
        <Text style={{ color: '#64748B' }}>
          Dokument: {formatDateTime(order.docDate ?? null)}
        </Text>
        {order.dueDate ? (
          <Text style={{ color: '#64748B' }}>
            Afati: {formatDateOnly(order.dueDate)}
          </Text>
        ) : null}
      </SectionCard>

      {order.customerSnapshot ? (
        <SectionCard title="Snapshot i Klientit" subtitle="Gjendja financiare dhe komerciale në momentin e këtij order-i.">
          <View style={uiStyles.wrapRow}>
            <MetricTile label="Outstanding" value={`${formatNumber(order.customerSnapshot.outstandingAmount ?? 0)} EUR`} />
            <MetricTile label="Credit Limit" value={`${formatNumber(order.customerSnapshot.creditLimit ?? 0)} EUR`} />
            <MetricTile label="Credit Usage" value={`${formatNumber(order.customerSnapshot.creditUsagePercent ?? 0, 1)}%`} />
            <MetricTile label="Fatura Hapura" value={order.customerSnapshot.openInvoicesCount ?? 0} />
          </View>
          <View style={uiStyles.wrapRow}>
            <MetricTile label="Overdue" value={order.customerSnapshot.overdueInvoicesCount ?? 0} />
            <MetricTile label="Objekte" value={order.customerSnapshot.objectCount ?? 0} />
            <MetricTile label="Fatura të Postuara" value={order.customerSnapshot.postedInvoiceCount ?? 0} />
          </View>
          {order.customerSnapshot.lastInvoice ? (
            <Text style={{ color: '#475569' }}>
              Fatura e fundit: {order.customerSnapshot.lastInvoice.docNo} | {formatDateOnly(order.customerSnapshot.lastInvoice.docDate)} | Outstanding {formatNumber(order.customerSnapshot.lastInvoice.outstandingAmount ?? 0)} EUR
            </Text>
          ) : null}
        </SectionCard>
      ) : null}

      {order.documentReadiness ? (
        <SectionCard title="Gatishmëria për Dokument" subtitle="A është order-i i pastër për faturim/kthim dhe çfarë mbetet operative.">
          <View style={uiStyles.wrapRow}>
            <MetricTile label="Open Tasks" value={order.documentReadiness.openTasks} />
            <MetricTile label="Blocked" value={order.documentReadiness.blockedTasks} />
            <MetricTile label="Short" value={order.documentReadiness.shortTasks} />
            <MetricTile label="Done" value={order.documentReadiness.doneTasks} />
          </View>
          <Text style={{ color: order.documentReadiness.canCreateDocument ? '#0F9D58' : '#D97706', fontWeight: '700' }}>
            {order.documentReadiness.canCreateDocument
              ? 'Ky order është gati për dokument pa exception operative.'
              : 'Order-i ende ka hapa ose exception që duhen parë.'}
          </Text>
          {order.documentReadiness.warnings.length ? (
            <View style={uiStyles.gap8}>
              {order.documentReadiness.warnings.map((warning, index) => (
                <Text key={`${warning}-${index}`} style={{ color: '#B45309' }}>
                  - {warning}
                </Text>
              ))}
            </View>
          ) : null}
          {order.documentReadiness.nextActions.length ? (
            <View style={uiStyles.gap8}>
              {order.documentReadiness.nextActions.map((entry, index) => (
                <Text key={`${entry}-${index}`} style={{ color: '#334155' }}>
                  - {entry}
                </Text>
              ))}
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {canManage ? (
        <SectionCard title="Veprime të Shpejta" subtitle="Kalimet kryesore të workflow-it të agjentit.">
          <View style={uiStyles.gap8}>
            <Button
              label="Kopjo si Order i Ri"
              variant="ghost"
              loading={actionLoading === 'clone'}
              onPress={() =>
                void runAction('clone', async () => {
                  const created = await apiRequest<AgentOrder>(apiUrl, `/agent-orders/${order.id}/clone`, {
                    method: 'POST',
                    token,
                    body: {},
                  });
                  router.push(`/agent-orders/${created.id}` as any);
                })
              }
            />
            {order.status === 'DRAFT' ? (
              <Button
                label="Submit Order"
                loading={actionLoading === 'submit'}
                onPress={() =>
                  void runAction('submit', async () => {
                    await apiRequest(apiUrl, `/agent-orders/${order.id}/submit`, {
                      method: 'POST',
                      token,
                      body: {},
                    });
                  })
                }
              />
            ) : null}
            {['DRAFT', 'SUBMITTED'].includes(order.status) ? (
              <Button
                label="Approve Order"
                variant="secondary"
                loading={actionLoading === 'approve'}
                onPress={() =>
                  void runAction('approve', async () => {
                    await apiRequest(apiUrl, `/agent-orders/${order.id}/approve`, {
                      method: 'POST',
                      token,
                      body: {},
                    });
                  })
                }
              />
            ) : null}
            {order.status === 'WMS_ASSIGNED' ? (
              <Button
                label="Fillo Picking"
                variant="secondary"
                loading={actionLoading === 'start'}
                onPress={() =>
                  void runAction('start', async () => {
                    await apiRequest(apiUrl, `/agent-orders/${order.id}/start`, {
                      method: 'POST',
                      token,
                      body: {},
                    });
                  })
                }
              />
            ) : null}
            {['WMS_ASSIGNED', 'PICKING'].includes(order.status) ? (
              <Button
                label="Përfundo WMS"
                variant="secondary"
                loading={actionLoading === 'complete-wms'}
                onPress={() =>
                  void runAction('complete-wms', async () => {
                    await apiRequest(apiUrl, `/agent-orders/${order.id}/complete-wms`, {
                      method: 'POST',
                      token,
                      body: {},
                    });
                  })
                }
              />
            ) : null}
            {!['DOCUMENT_CREATED', 'CANCELLED'].includes(order.status) ? (
              <Button
                label="Anulo Order-in"
                variant="danger"
                loading={actionLoading === 'cancel'}
                onPress={() =>
                  void runAction('cancel', async () => {
                    await apiRequest(apiUrl, `/agent-orders/${order.id}/cancel`, {
                      method: 'POST',
                      token,
                      body: {},
                    });
                  })
                }
              />
            ) : null}
          </View>
        </SectionCard>
      ) : null}

      {canAssign && ['SUBMITTED', 'APPROVED'].includes(order.status) ? (
        <SectionCard title="Cakto Picker" subtitle="Krijon ose rifreskon task-et WMS për këtë order.">
          <Label>Picker</Label>
          <View style={uiStyles.wrapRow}>
            {pickers.map((picker) => (
              <Button
                key={picker.id}
                label={picker.fullName}
                variant={selectedPickerId === picker.id ? 'primary' : 'ghost'}
                onPress={() => setSelectedPickerId(picker.id)}
              />
            ))}
          </View>
          <Label>Shënime</Label>
          <Input value={assignNotes} onChangeText={setAssignNotes} placeholder="Opsionale" />
          <Button
            label="Ruaj Caktimin"
            loading={actionLoading === 'assign'}
            disabled={!selectedPickerId}
            onPress={() =>
              void runAction('assign', async () => {
                await apiRequest(apiUrl, `/agent-orders/${order.id}/assign`, {
                  method: 'POST',
                  token,
                  body: {
                    assignedPickerId: selectedPickerId,
                    notes: assignNotes || undefined,
                  },
                });
              })
            }
          />
        </SectionCard>
      ) : null}

      {order.status === 'READY_FOR_DOCUMENT' ? (
        <SectionCard
          title={isReturnOrder ? 'Krijo Kthim Shitjeje' : 'Krijo Faturë Shitjeje'}
          subtitle="Nga mobile mund ta mbyllësh order-in edhe në dokument."
        >
          <Label>Seria</Label>
          <View style={uiStyles.wrapRow}>
            {seriesOptions.map((entry) => (
              <Button
                key={entry.id}
                label={entry.name ?? entry.code ?? entry.prefix ?? 'Series'}
                variant={selectedSeriesId === entry.id ? 'primary' : 'ghost'}
                onPress={() => setSelectedSeriesId(entry.id)}
              />
            ))}
          </View>

          {!isReturnOrder ? (
            <>
              <Label>Metoda e pagesës</Label>
              <View style={uiStyles.wrapRow}>
                {paymentMethods.map((entry) => (
                  <Button
                    key={entry.id}
                    label={entry.name ?? entry.code ?? 'Metodë'}
                    variant={selectedPaymentMethodId === entry.id ? 'primary' : 'ghost'}
                    onPress={() => setSelectedPaymentMethodId(entry.id)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {isReturnOrder ? (
            <>
              <Label>Arsyeja e kthimit</Label>
              <Input
                value={returnReason}
                onChangeText={setReturnReason}
                placeholder="P.sh. kthim i artikullit nga objekti"
              />
            </>
          ) : null}

          <Label>Shënime</Label>
          <Input
            value={documentNotes}
            onChangeText={setDocumentNotes}
            placeholder="Opsionale"
          />

          <Button
            label={isReturnOrder ? 'Krijo Sales Return' : 'Krijo dhe Posto Faturën'}
            loading={actionLoading === 'create-doc'}
            disabled={!selectedSeriesId}
            onPress={() =>
              void runAction('create-doc', async () => {
                if (isReturnOrder) {
                  await apiRequest(apiUrl, `/agent-orders/${order.id}/create-sales-return`, {
                    method: 'POST',
                    token,
                    body: {
                      seriesId: selectedSeriesId,
                      reason: returnReason || undefined,
                      notes: documentNotes || undefined,
                    },
                  });
                  return;
                }

                await apiRequest(apiUrl, `/agent-orders/${order.id}/create-sales-invoice`, {
                  method: 'POST',
                  token,
                  body: {
                    seriesId: selectedSeriesId,
                    paymentMethodId: selectedPaymentMethodId || undefined,
                    notes: documentNotes || undefined,
                    postImmediately: true,
                  },
                });
              })
            }
          />
        </SectionCard>
      ) : null}

      <SectionCard title="Rreshtat" subtitle={`${lines.length} rreshta në order`}>
        {lines.map((line) => (
          <View
            key={line.id}
            style={{
              borderWidth: 1,
              borderColor: '#E2E8F0',
              borderRadius: 14,
              padding: 12,
              gap: 6,
            }}
          >
            <Text style={{ fontWeight: '700', color: '#0F172A' }}>
              {line.item?.code ?? '-'} | {line.item?.name ?? line.description ?? 'Artikull'}
            </Text>
            <Text style={{ color: '#334155' }}>
              Sasia {formatQty(line.qty)} | Çmimi {formatNumber(line.unitPrice)} EUR | TVSH {formatNumber(line.taxPercent, 0)}%
            </Text>
            {line.notes ? <Text style={{ color: '#64748B' }}>{line.notes}</Text> : null}
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Task-et WMS" subtitle={`${order.tasks?.length ?? 0} task-e të lidhura`}>
        {order.tasks?.length ? (
          order.tasks.map((task) => (
            <View
              key={task.id}
              style={{
                borderWidth: 1,
                borderColor: '#E2E8F0',
                borderRadius: 14,
                padding: 12,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                  {task.taskType} | {task.referenceNo ?? '-'}
                </Text>
                <StatusBadge value={task.status} />
              </View>
              <Text style={{ color: '#334155' }}>
                {task.item?.code ?? '-'} | {task.item?.name ?? '-'} | Qty {formatQty(task.qty)}
              </Text>
              <Text style={{ color: '#64748B' }}>
                {task.sourceLocation?.code ?? '-'} → {task.destinationLocation?.code ?? '-'}
              </Text>
              <View style={uiStyles.wrapRow}>
                <Button
                  label="Hap Task-un"
                  variant="secondary"
                  onPress={() => router.push(`/picker-tasks/${task.id}` as any)}
                />
              </View>
            </View>
          ))
        ) : (
          <EmptyState title="Nuk ka task-e WMS ende" />
        )}
      </SectionCard>

      <SectionCard title="Timeline" subtitle="Krijimi, caktimi, WMS veprimet dhe dokumentimi mblidhen këtu në rend kohor.">
        {order.timeline?.length ? (
          order.timeline.map((entry) => (
            <View
              key={entry.id}
              style={{
                borderWidth: 1,
                borderColor: '#E2E8F0',
                borderRadius: 14,
                padding: 12,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <StatusBadge value={entry.action} />
                <Text style={{ color: '#64748B', fontSize: 12 }}>
                  {formatDateTime(entry.createdAt)}
                </Text>
              </View>
              <Text style={{ color: '#334155', fontWeight: '600' }}>
                {entry.scope === 'TASK'
                  ? `${entry.taskType ?? 'Task'} | ${entry.referenceNo ?? '-'}`
                  : 'Agent Order'}
              </Text>
              <Text style={{ color: '#475569' }}>
                {entry.user?.fullName ?? entry.user?.email ?? 'Operator i paidentifikuar'}
              </Text>
              <Text style={{ color: '#64748B' }}>
                {entry.taskStatus ? `Statusi task-ut: ${sentenceStatus(entry.taskStatus)}` : sentenceStatus(entry.action)}
              </Text>
            </View>
          ))
        ) : (
          <EmptyState title="Nuk ka timeline ende" />
        )}
      </SectionCard>
    </Screen>
  );
}
