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
  MetricTile,
  Screen,
  SectionCard,
  SessionActions,
  StatusBadge,
  TopTitle,
  uiStyles,
} from '../../../src/components/ui';
import { apiList, apiRequest } from '../../../src/lib/api';
import { formatDateOnly, formatDateTime, formatQty, sentenceStatus } from '../../../src/lib/format';
import {
  enqueuePickerAction,
  listQueuedPickerActions,
  removeQueuedPickerAction,
  type QueuedPickerAction,
} from '../../../src/lib/offline-queue';
import { hasPermission, PERMISSIONS } from '../../../src/lib/permissions';
import type { PickerOption, WmsTask } from '../../../src/types';
import { useAuth } from '../../../src/providers/auth-provider';

type ScanTarget = 'location' | 'item' | null;
type LocationSuggestion = {
  code: string;
  barcode?: string | null;
};

const SHORT_REASONS = [
  'NO_STOCK',
  'DAMAGED',
  'EXPIRED',
  'LOT_MISMATCH',
  'SERIAL_MISMATCH',
  'LOCATION_MISMATCH',
  'OTHER',
];

function summarizeAudit(metadata?: Record<string, unknown> | null) {
  if (!metadata) return null;
  const parts: string[] = [];
  if (metadata.pickedQty) parts.push(`Pick ${metadata.pickedQty}`);
  if (metadata.shortQty) parts.push(`Short ${metadata.shortQty}`);
  if (metadata.locationCode) parts.push(`Lokacioni ${String(metadata.locationCode)}`);
  if (metadata.itemCode) parts.push(`Artikulli ${String(metadata.itemCode)}`);
  if (metadata.reasonCode) parts.push(`Arsye ${String(metadata.reasonCode)}`);
  if (metadata.resultingStatus) parts.push(`Statusi ${String(metadata.resultingStatus)}`);
  if (metadata.notes) parts.push(String(metadata.notes));
  return parts.join(' | ') || null;
}

export default function PickerTaskWorkflowScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiUrl, token, logout, user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [task, setTask] = useState<WmsTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [locationCode, setLocationCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [qty, setQty] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [shortQty, setShortQty] = useState('');
  const [shortReason, setShortReason] = useState('NO_STOCK');
  const [notes, setNotes] = useState('');
  const [scanTarget, setScanTarget] = useState<ScanTarget>(null);
  const [suggestedLocations, setSuggestedLocations] = useState<LocationSuggestion[]>([]);
  const [pickers, setPickers] = useState<PickerOption[]>([]);
  const [selectedPickerId, setSelectedPickerId] = useState('');
  const [queuedActions, setQueuedActions] = useState<QueuedPickerAction[]>([]);

  const canManageTask = hasPermission(user, PERMISSIONS.wmsManage);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const nextTask = await apiRequest<WmsTask>(apiUrl, `/wms/tasks/${id}`, { token });
      const nextPickers = canManageTask
        ? await apiRequest<PickerOption[]>(apiUrl, '/agent-orders/pickers', { token })
        : [];
      setTask(nextTask);
      const nextQueuedActions = await listQueuedPickerActions();
      setQueuedActions(nextQueuedActions.filter((entry) => entry.taskId === nextTask.id));
      setPickers(nextPickers);
      setSelectedPickerId((current) => current || nextTask.assignedToId || nextPickers[0]?.id || '');
      setQty(String(Number(nextTask.qty ?? 0)));
      setShortQty(String(Number(nextTask.qty ?? 0)));
      setLocationCode((current) => current || nextTask.sourceLocation?.code || '');
      setItemCode(
        (current) => current || nextTask.item?.barcode || nextTask.item?.code || '',
      );
      setLotCode((current) => current || nextTask.lotCode || '');
      setSerialNo((current) => current || nextTask.serialNo || '');
      setExpiryDate(
        (current) =>
          current ||
          (nextTask.expiryDate ? new Date(nextTask.expiryDate).toISOString().slice(0, 10) : ''),
      );

      if (nextTask.itemId) {
        const balances = await apiRequest<{
          items?: Array<{
            location?: { code?: string | null; barcode?: string | null } | null;
          }>;
        }>(apiUrl, '/wms/balances', {
          token,
          query: { itemId: nextTask.itemId, limit: 8 },
        });
        const nextSuggestions = (balances.items ?? [])
          .map((entry) => entry.location)
          .filter((entry): entry is { code?: string | null; barcode?: string | null } => Boolean(entry?.code))
          .map((entry) => ({ code: entry.code!, barcode: entry.barcode ?? null }))
          .filter(
            (entry, index, all) =>
              all.findIndex((candidate) => candidate.code === entry.code) === index,
          );
        setSuggestedLocations(nextSuggestions);
      } else {
        setSuggestedLocations([]);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, canManageTask, id, token]);

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

  function useExpectedValues() {
    if (!task) return;
    setLocationCode(task.sourceLocation?.barcode || task.sourceLocation?.code || '');
    setItemCode(task.item?.barcode || task.item?.code || '');
    setQty(String(Number(task.qty ?? 0)));
    setLotCode(task.lotCode || '');
    setSerialNo(task.serialNo || '');
    setExpiryDate(
      task.expiryDate ? new Date(task.expiryDate).toISOString().slice(0, 10) : '',
    );
    setSuccess('Vlerat e pritura u vendosën. Tani vetëm konfirmo pick-un.');
  }

  async function goToNextOpenTask() {
    if (!token || !task) return;
    const allTasks = await apiList<WmsTask>(apiUrl, '/wms/tasks', {
      token,
      query: { limit: 100 },
    });
    const openTasks = allTasks.filter(
      (entry) =>
        entry.id !== task.id &&
        ['PENDING', 'IN_PROGRESS', 'BLOCKED'].includes(entry.status) &&
        (!entry.assignedToId || entry.assignedToId === user?.id),
    );
    const sameReference = openTasks.find(
      (entry) => task.referenceNo && entry.referenceNo === task.referenceNo,
    );
    const nextTask = sameReference ?? openTasks[0];
    if (nextTask) {
      router.replace(`/picker-tasks/${nextTask.id}` as any);
    } else {
      router.replace('/picker-tasks');
    }
  }

  async function confirmPick(moveNext: boolean) {
    if (!task) return;
    await runAction(moveNext ? 'pick-confirm-next' : 'pick-confirm', async () => {
      await apiRequest(apiUrl, `/wms/tasks/${task.id}/pick-confirm`, {
        method: 'POST',
        token,
        body: buildPickConfirmBody(),
      });
      setSuccess(
        moveNext
          ? 'Pick-u u konfirmua. Po hapet task-u i radhës.'
          : 'Pick-u u konfirmua për këtë task.',
      );
      if (moveNext) {
        await goToNextOpenTask();
      }
    });
  }

  async function registerShort(moveNext: boolean) {
    if (!task) return;
    await runAction(moveNext ? 'short-task-next' : 'short-task', async () => {
      await apiRequest(apiUrl, `/wms/tasks/${task.id}/short`, {
        method: 'POST',
        token,
        body: buildShortBody(),
      });
      setSuccess(
        moveNext
          ? 'Short-i u regjistrua. Po hapet task-u i radhës.'
          : 'Short-i u regjistrua dhe task-u u përditësua.',
      );
      if (moveNext) {
        await goToNextOpenTask();
      }
    });
  }

  function buildPickConfirmBody() {
    return {
      locationCode,
      itemCode,
      qty: Number(qty || 0),
      lotCode: lotCode || undefined,
      serialNo: serialNo || undefined,
      expiryDate: expiryDate || undefined,
      notes: notes || undefined,
    };
  }

  function buildShortBody() {
    return {
      shortQty: Number(shortQty || 0),
      reasonCode: shortReason,
      notes: notes || undefined,
    };
  }

  async function queuePickerAction(entry: Omit<QueuedPickerAction, 'id' | 'createdAt'>) {
    const queued = await enqueuePickerAction(entry);
    setQueuedActions((current) => [queued, ...current]);
    setSuccess('Veprimi u ruajt offline dhe do sinkronizohet më vonë.');
  }

  async function syncQueuedActions() {
    await runAction('sync-queue', async () => {
      const current = await listQueuedPickerActions();
      const forThisTask = current.filter((entry) => entry.taskId === task?.id);
      for (const entry of forThisTask) {
        await apiRequest(apiUrl, entry.path, {
          method: entry.method,
          token,
          body: entry.body,
        });
        await removeQueuedPickerAction(entry.id);
      }
      setQueuedActions([]);
      setSuccess('Queue offline u sinkronizua me backend.');
    });
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
  const requiresTracking = Boolean(task.lotCode || task.serialNo || task.expiryDate);
  const taskIsOpen = !['DONE', 'CANCELLED', 'SHORT'].includes(task.status);

  return (
    <Screen scroll>
      <TopTitle
        title={`${task.taskType} | ${task.referenceNo ?? '-'}`}
        subtitle="Workflow i picker-it me scan, partial pick, short handling dhe audit të plotë."
      />

      <SessionActions onHome={() => router.push('/home')} onLogout={() => void logout()} />

      {success ? (
        <SectionCard title="U krye">
          <Text style={{ color: '#0F9D58' }}>{success}</Text>
        </SectionCard>
      ) : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {task.progress ? (
        <SectionCard title="Progresi i Task-ut" subtitle="Sa është trajtuar, sa ka mbetur dhe gjurma e fundit e punës.">
          <View style={uiStyles.wrapRow}>
            <MetricTile label="Planifikuar" value={formatQty(task.progress.initialQty)} />
            <MetricTile label="Picked" value={formatQty(task.progress.pickedQty)} />
            <MetricTile label="Short" value={formatQty(task.progress.shortQty)} />
            <MetricTile label="Mbetur" value={formatQty(task.progress.remainingQty)} />
          </View>
          <Text style={{ color: '#334155' }}>
            Përfundim: {task.progress.completionPercent}% | Veprimi i fundit:{' '}
            {sentenceStatus(task.progress.latestAction)}
          </Text>
        </SectionCard>
      ) : null}

      <SectionCard title="Offline Queue" subtitle="Veprimet e ruajtura pa lidhje ruhen lokalisht dhe dërgohen kur API është gati.">
        <View style={uiStyles.wrapRow}>
          <MetricTile label="Në pritje" value={queuedActions.length} />
          <MetricTile label="Task" value={task.referenceNo ?? task.id.slice(0, 8)} />
        </View>
        {queuedActions.map((entry) => (
          <View
            key={entry.id}
            style={{
              borderWidth: 1,
              borderColor: '#D8E0EA',
              borderRadius: 14,
              padding: 12,
              gap: 4,
            }}
          >
            <StatusBadge value={entry.action} />
            <Text style={{ color: '#334155' }}>{entry.summary}</Text>
            <Text style={{ color: '#64748B', fontSize: 12 }}>
              {formatDateTime(entry.createdAt)}
            </Text>
          </View>
        ))}
        <Button
          label="Sinkronizo Queue"
          variant="secondary"
          disabled={!queuedActions.length}
          loading={busy === 'sync-queue'}
          onPress={() => void syncQueuedActions()}
        />
      </SectionCard>

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
        {task.expiryDate ? (
          <Text style={{ color: '#64748B' }}>Skadenca: {formatDateOnly(task.expiryDate)}</Text>
        ) : null}
        <Text style={{ color: '#64748B', fontSize: 12 }}>
          Krijuar: {formatDateTime(task.createdAt)}
        </Text>
      </SectionCard>

      <SectionCard title="Workflow i Shpejtë" subtitle="Përdor këtë pjesë për punën ditore: nis, mbush vlerat e pritura, konfirmo dhe kalo te task-u tjetër.">
        <View style={uiStyles.wrapRow}>
          {task.status === 'PENDING' ? (
            <Button
              label="Nis Task-un"
              loading={busy === 'start-task'}
              onPress={() =>
                void runAction('start-task', async () => {
                  await apiRequest(apiUrl, `/wms/tasks/${task.id}/start`, {
                    method: 'POST',
                    token,
                    body: { notes: 'Started from mobile quick workflow' },
                  });
                  setSuccess('Task-u u nis. Vlerat janë gati për konfirmim.');
                })
              }
            />
          ) : null}
          <Button label="Përdor të Priturat" variant="secondary" onPress={useExpectedValues} />
          <Button
            label="Hap Task-in Tjetër"
            variant="ghost"
            onPress={() => void goToNextOpenTask()}
          />
        </View>
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

      {canManageTask ? (
        <SectionCard title="Supervisor / Exception" subtitle="Reassign, rifillo task të bllokuar ose mbylle me vendim operativ.">
          <Label>Ricaktimi</Label>
          <View style={uiStyles.wrapRow}>
            {pickers.map((picker) => (
              <Button
                key={picker.id}
                label={picker.fullName}
                variant={selectedPickerId === picker.id ? 'secondary' : 'ghost'}
                onPress={() => setSelectedPickerId(picker.id)}
              />
            ))}
          </View>
          <Button
            label="Ricakto Task-un"
            variant="secondary"
            loading={busy === 'reassign'}
            disabled={!selectedPickerId}
            onPress={() =>
              void runAction('reassign', async () => {
                await apiRequest(apiUrl, `/wms/tasks/${task.id}/reassign`, {
                  method: 'POST',
                  token,
                  body: {
                    assignedToId: selectedPickerId,
                    notes: notes || undefined,
                  },
                });
                setSuccess('Task-u u ricaktua me sukses.');
              })
            }
          />
          {task.status === 'BLOCKED' ? (
            <View style={uiStyles.wrapRow}>
              <Button
                label="Rifillo Task-un"
                variant="ghost"
                loading={busy === 'reopen-blocked'}
                onPress={() =>
                  void runAction('reopen-blocked', async () => {
                    await apiRequest(apiUrl, `/wms/tasks/${task.id}/start`, {
                      method: 'POST',
                      token,
                      body: { notes: notes || 'Reopened by supervisor' },
                    });
                    setSuccess('Task-u u kthye në IN_PROGRESS.');
                  })
                }
              />
              <Button
                label="Mbylle si Complete"
                variant="ghost"
                loading={busy === 'force-complete'}
                onPress={() =>
                  void runAction('force-complete', async () => {
                    await apiRequest(apiUrl, `/wms/tasks/${task.id}/complete`, {
                      method: 'POST',
                      token,
                      body: { notes: notes || 'Force completed by supervisor' },
                    });
                    setSuccess('Task-u u mbyll nga supervisor-i.');
                  })
                }
              />
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {task.taskType === 'PICK' && taskIsOpen ? (
        <>
          <SectionCard title="Scan ose Shkruaj" subtitle="Verifiko lokacionin dhe artikullin para konfirmimit.">
            <Label>Kodi i lokacionit</Label>
            <Input
              value={locationCode}
              onChangeText={setLocationCode}
              placeholder={task.sourceLocation?.barcode ?? task.sourceLocation?.code ?? 'Scan lokacionin'}
            />
            <View style={uiStyles.wrapRow}>
              {task.sourceLocation?.code ? (
                <Button
                  label={`Kodi: ${task.sourceLocation.code}`}
                  variant="ghost"
                  onPress={() => setLocationCode(task.sourceLocation?.code ?? '')}
                />
              ) : null}
              {task.sourceLocation?.barcode ? (
                <Button
                  label={`Barkodi: ${task.sourceLocation.barcode}`}
                  variant="ghost"
                  onPress={() => setLocationCode(task.sourceLocation?.barcode ?? '')}
                />
              ) : null}
              {!task.sourceLocation?.code && suggestedLocations.length
                ? suggestedLocations.map((entry) => (
                    <Button
                      key={entry.code}
                      label={entry.code}
                      variant="ghost"
                      onPress={() => setLocationCode(entry.code)}
                    />
                  ))
                : null}
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
              {task.item?.code ? (
                <Button
                  label={`Kodi: ${task.item.code}`}
                  variant="ghost"
                  onPress={() => setItemCode(task.item?.code ?? '')}
                />
              ) : null}
              {task.item?.barcode ? (
                <Button
                  label={`Barkodi: ${task.item.barcode}`}
                  variant="ghost"
                  onPress={() => setItemCode(task.item?.barcode ?? '')}
                />
              ) : null}
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

            {requiresTracking ? (
              <>
                <Label>Lot kodi</Label>
                <Input
                  value={lotCode}
                  onChangeText={setLotCode}
                  placeholder={task.lotCode ?? 'Lot kodi'}
                />
                <View style={uiStyles.wrapRow}>
                  {task.lotCode ? (
                    <Button
                      label={`Lot: ${task.lotCode}`}
                      variant="ghost"
                      onPress={() => setLotCode(task.lotCode ?? '')}
                    />
                  ) : null}
                </View>

                <Label>Serial number</Label>
                <Input
                  value={serialNo}
                  onChangeText={setSerialNo}
                  placeholder={task.serialNo ?? 'Serial number'}
                />
                <View style={uiStyles.wrapRow}>
                  {task.serialNo ? (
                    <Button
                      label={`Serial: ${task.serialNo}`}
                      variant="ghost"
                      onPress={() => setSerialNo(task.serialNo ?? '')}
                    />
                  ) : null}
                </View>

                <Label>Data e skadencës</Label>
                <Input
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                  placeholder="YYYY-MM-DD"
                />
                <View style={uiStyles.wrapRow}>
                  {task.expiryDate ? (
                    <Button
                      label={`Skadenca: ${new Date(task.expiryDate).toISOString().slice(0, 10)}`}
                      variant="ghost"
                      onPress={() =>
                        setExpiryDate(
                          task.expiryDate
                            ? new Date(task.expiryDate).toISOString().slice(0, 10)
                            : '',
                        )
                      }
                    />
                  ) : null}
                </View>
              </>
            ) : null}

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
              onPress={() => void confirmPick(false)}
            />
            <Button
              label="Konfirmo Pick + Tjetri"
              variant="secondary"
              loading={busy === 'pick-confirm-next'}
              onPress={() => void confirmPick(true)}
            />
            <Button
              label="Ruaj Pick Offline"
              variant="ghost"
              onPress={() =>
                void queuePickerAction({
                  taskId: task.id,
                  action: 'pick-confirm',
                  path: `/wms/tasks/${task.id}/pick-confirm`,
                  method: 'POST',
                  body: buildPickConfirmBody(),
                  summary: `Pick ${qty || 0} | ${locationCode || '-'} | ${itemCode || '-'}`,
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

          <SectionCard title="Short / Exception" subtitle="Regjistro mungesën me sasi dhe arsye të qartë. Nëse sasia është më e vogël se mbetja, task-u mbetet blocked për veprim të mëtejshëm.">
            <Label>Sasia në short</Label>
            <Input
              value={shortQty}
              onChangeText={setShortQty}
              keyboardType="numeric"
              placeholder={String(Number(task.qty ?? 0))}
            />

            <Label>Arsyeja</Label>
            <View style={uiStyles.wrapRow}>
              {SHORT_REASONS.map((entry) => (
                <Button
                  key={entry}
                  label={entry}
                  variant={shortReason === entry ? 'secondary' : 'ghost'}
                  onPress={() => setShortReason(entry)}
                />
              ))}
            </View>

            <Button
              label="Regjistro Short"
              variant="ghost"
              loading={busy === 'short-task'}
              onPress={() => void registerShort(false)}
            />
            <Button
              label="Short + Tjetri"
              variant="secondary"
              loading={busy === 'short-task-next'}
              onPress={() => void registerShort(true)}
            />
            <Button
              label="Ruaj Short Offline"
              variant="ghost"
              onPress={() =>
                void queuePickerAction({
                  taskId: task.id,
                  action: 'short',
                  path: `/wms/tasks/${task.id}/short`,
                  method: 'POST',
                  body: buildShortBody(),
                  summary: `Short ${shortQty || 0} | ${shortReason}`,
                })
              }
            />
          </SectionCard>
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

      {task.taskType === 'PACK' && taskIsOpen ? (
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
          <Button
            label="Ruaj Packing Offline"
            variant="ghost"
            onPress={() =>
              void queuePickerAction({
                taskId: task.id,
                action: 'pack',
                path: `/wms/packing/sales-invoices/${task.sourceId}/pack`,
                method: 'POST',
                body: {},
                summary: `Packing | ${task.referenceNo ?? task.sourceId ?? '-'}`,
              })
            }
          />
          <Label>Arsye short / exception</Label>
          <View style={uiStyles.wrapRow}>
            {SHORT_REASONS.map((entry) => (
              <Button
                key={entry}
                label={entry}
                variant={shortReason === entry ? 'secondary' : 'ghost'}
                onPress={() => setShortReason(entry)}
              />
            ))}
          </View>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Shënim për packing exception"
            multiline
          />
          <Button
            label="Shëno PACK si Short"
            variant="ghost"
            loading={busy === 'short-pack'}
            onPress={() =>
              void runAction('short-pack', async () => {
                await apiRequest(apiUrl, `/wms/tasks/${task.id}/short`, {
                  method: 'POST',
                  token,
                  body: {
                    reasonCode: shortReason,
                    notes: notes || undefined,
                  },
                });
                setSuccess('Pack task u kalua në short me arsye.');
              })
            }
          />
          <Button
            label="Ruaj PACK Short Offline"
            variant="ghost"
            onPress={() =>
              void queuePickerAction({
                taskId: task.id,
                action: 'short',
                path: `/wms/tasks/${task.id}/short`,
                method: 'POST',
                body: {
                  reasonCode: shortReason,
                  notes: notes || undefined,
                },
                summary: `PACK short | ${shortReason}`,
              })
            }
          />
        </SectionCard>
      ) : null}

      {task.auditTrail?.length ? (
        <SectionCard title="Histori veprimesh" subtitle="Çdo start, pick, short dhe pack ruhet këtu për kontroll operativ.">
          {task.auditTrail.map((entry) => (
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
              <View style={uiStyles.wrapRow}>
                <StatusBadge value={entry.action} />
                <Text style={{ color: '#64748B', fontSize: 12 }}>
                  {formatDateTime(entry.createdAt)}
                </Text>
              </View>
              <Text style={{ color: '#334155' }}>
                {entry.user?.fullName ?? entry.user?.email ?? 'Operator i paidentifikuar'}
              </Text>
              {summarizeAudit(entry.metadata) ? (
                <Text style={{ color: '#475569' }}>{summarizeAudit(entry.metadata)}</Text>
              ) : null}
            </View>
          ))}
        </SectionCard>
      ) : null}
    </Screen>
  );
}
