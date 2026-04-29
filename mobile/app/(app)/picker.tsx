import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  ErrorState,
  LoadingState,
  MetricTile,
  Screen,
  SessionActions,
  SectionCard,
  TopTitle,
  uiStyles,
} from '../../src/components/ui';
import { apiList } from '../../src/lib/api';
import type { WmsTask } from '../../src/types';
import { useAuth } from '../../src/providers/auth-provider';

export default function PickerDashboardScreen() {
  const router = useRouter();
  const { apiUrl, token, user, logout } = useAuth();
  const [tasks, setTasks] = useState<WmsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiList<WmsTask>(apiUrl, '/wms/tasks', {
        token,
        query: { limit: 100 },
      });
      setTasks(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const myTasks = tasks.filter((task) => task.assignedToId === user?.id);
  const openTasks = myTasks.filter((task) => ['PENDING', 'IN_PROGRESS', 'BLOCKED'].includes(task.status));
  const doneTasks = myTasks.filter((task) => task.status === 'DONE');

  return (
    <Screen scroll>
      <TopTitle
        title="Picker Dashboard"
        subtitle="Detyrat e mia, picking aktiv dhe qasja e shpejtë te scanner-i."
      />

      <SessionActions onHome={() => router.push('/home')} onLogout={() => void logout()} />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error ? (
        <>
          <View style={uiStyles.wrapRow}>
            <MetricTile label="Të miat" value={myTasks.length} />
            <MetricTile label="Hapur" value={openTasks.length} />
            <MetricTile label="Kryer" value={doneTasks.length} />
          </View>

          <SectionCard title="Shkurtore" subtitle="Nga këtu kalon te operacionet kryesore.">
            <Button label="Hap Detyrat WMS" onPress={() => router.push('/picker-tasks')} />
            <Button label="Hap Scanner" variant="secondary" onPress={() => router.push('/scanner')} />
          </SectionCard>
        </>
      ) : null}
    </Screen>
  );
}
