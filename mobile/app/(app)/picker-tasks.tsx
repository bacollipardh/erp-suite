import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Screen,
  SessionActions,
  SectionCard,
  StatusBadge,
  TopTitle,
} from '../../src/components/ui';
import { apiList, apiRequest } from '../../src/lib/api';
import { formatDateTime, formatQty } from '../../src/lib/format';
import type { WmsTask } from '../../src/types';
import { useAuth } from '../../src/providers/auth-provider';

const FILTERS = ['MY_OPEN', 'ALL_OPEN', 'DONE', 'SHORT', 'BLOCKED'];

function workflowHint(task: WmsTask) {
  if (task.taskType === 'PICK') {
    return 'Nis task-un, pastaj konfirmo picking-un që rezervimet të kalojnë në picked dhe të krijohet pack step.';
  }
  if (task.taskType === 'PACK') {
    return 'Pas picking-ut, konfirmo packing-un që dokumenti të jetë gati për postim/shipping.';
  }
  if (task.taskType === 'SHIP') {
    return 'Task informues i shipping-ut. Zakonisht mbyllet nga postimi i faturës ose bypass-i i shitjes.';
  }
  return 'Task operativ WMS me status dhe gjurmë të plotë audit.';
}

export default function PickerTasksScreen() {
  const router = useRouter();
  const { apiUrl, token, user, logout } = useAuth();
  const [tasks, setTasks] = useState<WmsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('MY_OPEN');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiList<WmsTask>(apiUrl, '/wms/tasks', {
        token,
        query: { search, limit: 100 },
      });
      setTasks(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, search, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visibleTasks = useMemo(() => {
    if (filter === 'MY_OPEN') {
      return tasks.filter(
        (task) =>
          task.assignedToId === user?.id &&
          ['PENDING', 'IN_PROGRESS', 'BLOCKED'].includes(task.status),
      );
    }
    if (filter === 'ALL_OPEN') {
      return tasks.filter((task) =>
        ['PENDING', 'IN_PROGRESS', 'BLOCKED'].includes(task.status),
      );
    }
    if (filter === 'DONE') return tasks.filter((task) => task.status === 'DONE');
    if (filter === 'SHORT') return tasks.filter((task) => task.status === 'SHORT');
    return tasks.filter((task) => task.status === 'BLOCKED');
  }, [filter, tasks, user?.id]);

  async function runTaskAction(
    taskId: string,
    action: 'start' | 'complete' | 'short' | 'cancel',
  ) {
    setActionLoading(`${taskId}:${action}`);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(apiUrl, `/wms/tasks/${taskId}/${action}`, {
        method: 'POST',
        token,
        body: {},
      });
      setSuccess(
        action === 'start'
          ? 'Task-u u nis me sukses.'
          : action === 'complete'
            ? 'Task-u u mbyll me sukses.'
            : action === 'short'
              ? 'Task-u u kalua në SHORT.'
              : 'Task-u u anulua.',
      );
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function runWorkflowAction(
    task: WmsTask,
    action: 'confirm-pick' | 'release-pick' | 'confirm-pack',
  ) {
    if (!task.sourceId || task.sourceType !== 'SALES_INVOICE') {
      setError('Ky task nuk është i lidhur me një sales invoice workflow.');
      return;
    }
    setActionLoading(`${task.id}:${action}`);
    setError(null);
    setSuccess(null);
    try {
      if (action === 'confirm-pick') {
        await apiRequest(apiUrl, `/wms/picking/sales-invoices/${task.sourceId}/confirm`, {
          method: 'POST',
          token,
          body: {},
        });
        setSuccess('Picking u konfirmua. Pack step tani duhet të jetë gati.');
      } else if (action === 'release-pick') {
        await apiRequest(apiUrl, `/wms/picking/sales-invoices/${task.sourceId}/release`, {
          method: 'POST',
          token,
          body: {},
        });
        setSuccess('Rezervimet e picking-ut u liruan.');
      } else {
        await apiRequest(apiUrl, `/wms/packing/sales-invoices/${task.sourceId}/pack`, {
          method: 'POST',
          token,
          body: {},
        });
        setSuccess('Packing u konfirmua. Dokumenti është gati për postim/shipping.');
      }
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Workflow action failed');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <Screen scroll>
      <TopTitle
        title="Detyrat WMS"
        subtitle="Pamje mobile për picker-in me start, complete dhe short handling."
      />

      <SessionActions onHome={() => router.push('/home')} onLogout={() => void logout()} />

      {success ? (
        <SectionCard title="U krye">
          <Text style={{ color: '#0F9D58' }}>{success}</Text>
        </SectionCard>
      ) : null}

      <SectionCard title="Kërko dhe filtro">
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Referencë, artikull, lot, serial..."
          onSubmitEditing={() => void load()}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((entry) => (
            <Pressable
              key={entry}
              onPress={() => setFilter(entry)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: filter === entry ? '#2553EB' : '#D8E0EA',
                backgroundColor: filter === entry ? '#E8EEFF' : '#FFFFFF',
              }}
            >
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                {entry === 'MY_OPEN'
                  ? 'Të Miat'
                  : entry === 'ALL_OPEN'
                    ? 'Të Hapura'
                    : entry === 'DONE'
                      ? 'Kryer'
                      : entry === 'SHORT'
                        ? 'Short'
                      : 'Blocked'}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && visibleTasks.length === 0 ? (
        <EmptyState title="Nuk ka task-e për këtë filtër" />
      ) : null}

      {!loading && !error
        ? visibleTasks.map((task) => (
            <SectionCard
              key={task.id}
              title={`${task.taskType} | ${task.referenceNo ?? '-'}`}
              subtitle={task.item ? `${task.item.code} - ${task.item.name}` : 'Task WMS'}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <StatusBadge value={task.status} />
                <Text style={{ color: '#334155', fontWeight: '600' }}>
                  Qty {formatQty(task.qty)}
                </Text>
              </View>
              <Text style={{ color: '#475569' }}>
                Lokacionet: {task.sourceLocation?.code ?? '-'} → {task.destinationLocation?.code ?? '-'}
              </Text>
              <Text style={{ color: '#64748B', fontSize: 12 }}>
                Krijuar: {formatDateTime(task.createdAt)}
              </Text>
              <Text style={{ color: '#64748B', fontSize: 12 }}>
                {workflowHint(task)}
              </Text>

              <View style={{ gap: 8 }}>
                {task.status === 'PENDING' ? (
                  <Button
                    label="Start Task"
                    loading={actionLoading === `${task.id}:start`}
                    onPress={() => void runTaskAction(task.id, 'start')}
                  />
                ) : null}
                {task.taskType === 'PICK' && task.sourceType === 'SALES_INVOICE' && ['PENDING', 'IN_PROGRESS', 'BLOCKED'].includes(task.status) ? (
                  <>
                    <Button
                      label="Konfirmo Picking"
                      variant="secondary"
                      loading={actionLoading === `${task.id}:confirm-pick`}
                      onPress={() => void runWorkflowAction(task, 'confirm-pick')}
                    />
                    <Button
                      label="Liro Rezervimet"
                      variant="ghost"
                      loading={actionLoading === `${task.id}:release-pick`}
                      onPress={() => void runWorkflowAction(task, 'release-pick')}
                    />
                  </>
                ) : null}
                {task.taskType === 'PACK' && task.sourceType === 'SALES_INVOICE' && ['PENDING', 'IN_PROGRESS', 'BLOCKED'].includes(task.status) ? (
                  <Button
                    label="Konfirmo Packing"
                    variant="secondary"
                    loading={actionLoading === `${task.id}:confirm-pack`}
                    onPress={() => void runWorkflowAction(task, 'confirm-pack')}
                  />
                ) : null}
                {task.taskType !== 'PICK' && task.taskType !== 'PACK' && task.status === 'IN_PROGRESS' ? (
                  <>
                    <Button
                      label="Complete Task"
                      variant="secondary"
                      loading={actionLoading === `${task.id}:complete`}
                      onPress={() => void runTaskAction(task.id, 'complete')}
                    />
                    <Button
                      label="Shëno si Short"
                      variant="ghost"
                      loading={actionLoading === `${task.id}:short`}
                      onPress={() => void runTaskAction(task.id, 'short')}
                    />
                  </>
                ) : null}
                {['PICK', 'PACK'].includes(task.taskType) &&
                ['PENDING', 'IN_PROGRESS', 'BLOCKED'].includes(task.status) ? (
                  <Button
                    label="Shëno si Short"
                    variant="ghost"
                    loading={actionLoading === `${task.id}:short`}
                    onPress={() => void runTaskAction(task.id, 'short')}
                  />
                ) : null}
                {['PENDING', 'IN_PROGRESS'].includes(task.status) ? (
                  <Button
                    label="Cancel Task"
                    variant="danger"
                    loading={actionLoading === `${task.id}:cancel`}
                    onPress={() => void runTaskAction(task.id, 'cancel')}
                  />
                ) : null}
              </View>
            </SectionCard>
          ))
        : null}
    </Screen>
  );
}
