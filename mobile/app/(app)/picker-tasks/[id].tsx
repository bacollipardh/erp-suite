import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Screen,
  SectionCard,
  SessionActions,
  StatusBadge,
  TopTitle,
  uiStyles,
} from '../../../src/components/ui';
import { apiRequest } from '../../../src/lib/api';
import { formatDateTime, formatQty } from '../../../src/lib/format';
import type { WmsTask } from '../../../src/types';
import { useAuth } from '../../../src/providers/auth-provider';

type ScanTarget = 'location' | 'item' | null;

export default function PickerTaskWorkflowScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiUrl, token, logout } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [task, setTask] = useState<WmsTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [locationCode, setLocationCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [scanTarget, setScanTarget] = useState<ScanTarget>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const nextTask = await apiRequest<WmsTask>(apiUrl, `/wms/tasks/${id}`, {
        token,
      });
      setTask(nextTask);
      setQty(String(Number(nextTask.qty ?? 0)));
      setLocationCode((current) => current || nextTask.sourceLocation?.code || '');
      setItemCode(
        (current) => current || nextTask.item?.barcode || nextTask.item?.code || '',
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, id, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function runAction(key: string, runner: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      await runner();
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Duke ngarkuar task-un..." />
      </Screen>
    );
  }

  if (error && !task) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={() => void load()} />
      </Screen>
    );
  }

  if (!task) {
    return (
      <Screen>
        <EmptyState title="Task-u nuk u gjet" />
      </Screen>
    );
  }

  const invoiceReadyToFinalize =
    task.sourceType === 'SALES_INVOICE' &&
    task.sourceId &&
    Number(task.invoiceWorkflow?.reservedCount ?? 0) === 0;
  const agentOrderReadyToFinalize =
    task.sourceType === 'AGENT_ORDER' &&
    task.sourceId &&
    Number(task.agentOrderWorkflow?.openTasks ?? 0) === 0;

  return (
    <Screen scroll>
      <TopTitle
        title={`${task.taskType} | ${task.referenceNo ?? '-'}`}
        subtitle="Workflow i picker-it me scan, qty confirm dhe finalizim fature."
      />

      <SessionActions onHome={() => router.push('/home')} onLogout={() => void logout()} />

      {success ? (
        <SectionCard title="U krye">
          <Text style={{ color: '#0F9D58' }}>{success}</Text>
        </SectionCard>
      ) : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <SectionCard title="Detajet e Task-ut" subtitle={task.warehouse?.name ?? '-'}>
        <View style={uiStyles.wrapRow}>
          <StatusBadge value={task.status} />
          <StatusBadge value={task.taskType} />
        </View>
        <Text style={{ color: '#334155' }}>
          Artikulli: {task.item?.code ?? '-'} | {task.item?.name ?? '-'}
        </Text>
        <Text style={{ color: '#334155' }}>
          Lokacioni: {task.sourceLocation?.code ?? '-'}
          {task.destinationLocation?.code ? ` → ${task.destinationLocation.code}` : ''}
        </Text>
        <Text style={{ color: '#334155' }}>
          Sasia e mbetur për task: {formatQty(task.qty)}
        </Text>
        {task.lotCode ? <Text style={{ color: '#64748B' }}>Lot: {task.lotCode}</Text> : null}
        {task.serialNo ? <Text style={{ color: '#64748B' }}>Serial: {task.serialNo}</Text> : null}
        <Text style={{ color: '#64748B', fontSize: 12 }}>
          Krijuar: {formatDateTime(task.createdAt)}
        </Text>
      </SectionCard>

      {task.invoiceWorkflow ? (
        <SectionCard title="Gjendja e Faturës" subtitle="Përmbledhje e picking-ut për këtë sales invoice.">
          <Text style={{ color: '#334155' }}>
            Reserved: {formatQty(task.invoiceWorkflow.reservedQty)} | Picked: {formatQty(task.invoiceWorkflow.pickedQty)}
          </Text>
          <Text style={{ color: '#334155' }}>
            Pick task të hapura: {task.invoiceWorkflow.openPickTasks} | Pack task të hapura: {task.invoiceWorkflow.openPackTasks}
          </Text>
        </SectionCard>
      ) : null}

      {task.agentOrderWorkflow ? (
        <SectionCard title="Gjendja e Agent Order" subtitle="Përmbledhje e picking-ut për këtë order të agjentit.">
          <Text style={{ color: '#334155' }}>
            Task të hapura: {task.agentOrderWorkflow.openTasks} | Task të kryera: {task.agentOrderWorkflow.doneTasks}
          </Text>
        </SectionCard>
      ) : null}

      {task.taskType === 'PICK' &&
      !['DONE', 'CANCELLED', 'SHORT'].includes(task.status) ? (
        <>
          <SectionCard title="Scan ose Shkruaj" subtitle="Verifiko lokacionin dhe artikullin para konfirmimit.">
            <Label>Kodi i lokacionit</Label>
            <Input
              value={locationCode}
              onChangeText={setLocationCode}
              placeholder={task.sourceLocation?.barcode ?? task.sourceLocation?.code ?? 'Scan lokacionin'}
            />
            <View style={uiStyles.wrapRow}>
              <Button
                label="Përdor lokacionin e pritur"
                variant="ghost"
                onPress={() => setLocationCode(task.sourceLocation?.barcode ?? task.sourceLocation?.code ?? '')}
              />
              <Button
                label="Scan Lokacion"
                variant="secondary"
                onPress={() => setScanTarget('location')}
              />
            </View>

            <Label>Kodi / barkodi i artikullit</Label>
            <Input
              value={itemCode}
              onChangeText={setItemCode}
              placeholder={task.item?.barcode ?? task.item?.code ?? 'Scan artikullin'}
            />
            <View style={uiStyles.wrapRow}>
              <Button
                label="Përdor artikullin e pritur"
                variant="ghost"
                onPress={() => setItemCode(task.item?.barcode ?? task.item?.code ?? '')}
              />
              <Button
                label="Scan Artikull"
                variant="secondary"
                onPress={() => setScanTarget('item')}
              />
            </View>

            <Label>Sasia e picked</Label>
            <Input
              value={qty}
              onChangeText={setQty}
              keyboardType="numeric"
              placeholder={String(Number(task.qty ?? 0))}
            />

            <Label>Shënime</Label>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Opsionale"
              multiline
            />

            <Button
              label="Konfirmo këtë Pick"
              loading={busy === 'pick-confirm'}
              onPress={() =>
                void runAction('pick-confirm', async () => {
                  await apiRequest(apiUrl, `/wms/tasks/${task.id}/pick-confirm`, {
                    method: 'POST',
                    token,
                    body: {
                      locationCode,
                      itemCode,
                      qty: Number(qty || 0),
                      lotCode: task.lotCode ?? undefined,
                      serialNo: task.serialNo ?? undefined,
                      notes: notes || undefined,
                    },
                  });
                  setSuccess('Pick-u u konfirmua për këtë task.');
                })
              }
            />
          </SectionCard>

          {!permission?.granted ? (
            <SectionCard title="Leja e Kamerës" subtitle="Na duhet për scan të lokacionit dhe artikullit.">
              <Button label="Lejo Kamerën" onPress={() => void requestPermission()} />
            </SectionCard>
          ) : scanTarget ? (
            <SectionCard
              title={scanTarget === 'location' ? 'Scan Lokacioni' : 'Scan Artikulli'}
              subtitle="Sapo të lexohet kodi, fusha plotësohet automatikisht."
            >
              <View style={{ height: 280, overflow: 'hidden', borderRadius: 16 }}>
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  onBarcodeScanned={({ data }) => {
                    if (scanTarget === 'location') {
                      setLocationCode(data);
                    } else {
                      setItemCode(data);
                    }
                    setScanTarget(null);
                  }}
                />
              </View>
              <Button label="Mbyll Scanner" variant="ghost" onPress={() => setScanTarget(null)} />
            </SectionCard>
          ) : null}

        </>
      ) : null}

      {task.taskType === 'PICK' && invoiceReadyToFinalize ? (
        <SectionCard title="Finalizo Picking-un e Faturës" subtitle="Kur të gjitha pick-et janë kryer, konfirmo krejt faturën.">
          <Button
            label="Konfirmo Krejt Faturën"
            variant="secondary"
            loading={busy === 'finalize-invoice'}
            onPress={() =>
              void runAction('finalize-invoice', async () => {
                await apiRequest(apiUrl, `/wms/picking/sales-invoices/${task.sourceId}/finalize`, {
                  method: 'POST',
                  token,
                  body: {},
                });
                setSuccess('Fatura u finalizua për picking. Pack task tani duhet të jetë gati.');
              })
            }
          />
        </SectionCard>
      ) : null}

      {task.taskType === 'PICK' && agentOrderReadyToFinalize ? (
        <SectionCard title="Finalizo Agent Order" subtitle="Kur krejt task-et e picking-ut mbarojnë, kalo order-in gati për dokument.">
          <Button
            label="Konfirmo Krejt Order-in"
            variant="secondary"
            loading={busy === 'finalize-agent-order'}
            onPress={() =>
              void runAction('finalize-agent-order', async () => {
                await apiRequest(apiUrl, `/agent-orders/${task.sourceId}/complete-wms`, {
                  method: 'POST',
                  token,
                  body: {},
                });
                setSuccess('Agent order u finalizua dhe është gati për dokument.');
              })
            }
          />
        </SectionCard>
      ) : null}

      {task.taskType === 'PACK' && !['DONE', 'CANCELLED', 'SHORT'].includes(task.status) ? (
        <SectionCard title="Packing" subtitle="Pas finalizimit të picking-ut, konfirmo paketimin.">
          <Button
            label="Konfirmo Packing"
            loading={busy === 'confirm-pack'}
            onPress={() =>
              void runAction('confirm-pack', async () => {
                await apiRequest(apiUrl, `/wms/packing/sales-invoices/${task.sourceId}/pack`, {
                  method: 'POST',
                  token,
                  body: {},
                });
                setSuccess('Packing u konfirmua me sukses.');
              })
            }
          />
        </SectionCard>
      ) : null}
    </Screen>
  );
}
