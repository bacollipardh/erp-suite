import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Button,
  ErrorState,
  LoadingState,
  MetricTile,
  Screen,
  SectionCard,
  TopTitle,
  uiStyles,
} from '../../src/components/ui';
import { apiList } from '../../src/lib/api';
import { listQueuedAgentOrders } from '../../src/lib/offline-queue';
import {
  canUseAgentApp,
  canUsePickerApp,
  hasPermission,
  PERMISSIONS,
} from '../../src/lib/permissions';
import { useAuth } from '../../src/providers/auth-provider';

export default function HomeScreen() {
  const router = useRouter();
  const { user, apiUrl, logout, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{
    blockedTasks: number;
    shortTasks: number;
    readyOrders: number;
    queuedDrafts: number;
  }>({
    blockedTasks: 0,
    shortTasks: 0,
    readyOrders: 0,
    queuedDrafts: 0,
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [blockedTasks, shortTasks, readyOrders, queuedDrafts] = await Promise.all([
        canUsePickerApp(user)
          ? apiList<any>(apiUrl, '/wms/tasks', { token, query: { status: 'BLOCKED', limit: 100 } })
          : Promise.resolve([]),
        canUsePickerApp(user)
          ? apiList<any>(apiUrl, '/wms/tasks', { token, query: { status: 'SHORT', limit: 100 } })
          : Promise.resolve([]),
        canUseAgentApp(user)
          ? apiList<any>(apiUrl, '/agent-orders', { token, query: { status: 'READY_FOR_DOCUMENT', limit: 100 } })
          : Promise.resolve([]),
        listQueuedAgentOrders(),
      ]);
      setAlerts({
        blockedTasks: blockedTasks.length,
        shortTasks: shortTasks.length,
        readyOrders: readyOrders.length,
        queuedDrafts: queuedDrafts.length,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen scroll>
      <TopTitle
        title="ERP Mobile"
        subtitle="Qendra mobile për agjentin, picker-in dhe skanimin operativ."
      />

      <SectionCard title="Sesioni Aktiv" subtitle={apiUrl}>
        <View style={uiStyles.wrapRow}>
          <MetricTile label="Përdoruesi" value={user?.fullName ?? '-'} />
          <MetricTile label="Roli" value={user?.role ?? '-'} />
        </View>
        <Button label="Dil nga Sesioni" variant="ghost" onPress={() => void logout()} />
      </SectionCard>

      <SectionCard title="Njoftime Operative" subtitle="Sinjale të shpejta nga puna në terren dhe queue lokale.">
        {loading ? <LoadingState label="Duke kontrolluar sinjalet operative..." /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!loading && !error ? (
          <View style={uiStyles.wrapRow}>
            <MetricTile label="Blocked WMS" value={alerts.blockedTasks} />
            <MetricTile label="Short WMS" value={alerts.shortTasks} />
            <MetricTile label="Ready Orders" value={alerts.readyOrders} />
            <MetricTile label="Draft Queue" value={alerts.queuedDrafts} />
          </View>
        ) : null}
        <Text style={{ color: '#475569', lineHeight: 22 }}>
          Këto sinjale shërbejnë si hooks për njoftime operative në mobile edhe kur s’kemi futur ende push vendor-specific.
        </Text>
      </SectionCard>

      {canUseAgentApp(user) ? (
        <SectionCard
          title="Agjenti"
          subtitle="Orders, statuset operative dhe lidhja me picker-in."
        >
          <Button label="Hap Dashboard Agjenti" onPress={() => router.push('/agent')} />
          <Button
            label="Hap Agent Orders"
            variant="secondary"
            onPress={() => router.push('/agent-orders')}
          />
        </SectionCard>
      ) : null}

      {canUsePickerApp(user) ? (
        <SectionCard
          title="Picker / WMS"
          subtitle="Detyra operative, picking dhe short handling."
        >
          <Button label="Hap Dashboard Picker" onPress={() => router.push('/picker')} />
          <Button
            label="Hap Detyrat WMS"
            variant="secondary"
            onPress={() => router.push('/picker-tasks')}
          />
        </SectionCard>
      ) : null}

      {hasPermission(user, PERMISSIONS.wmsRead) ? (
        <SectionCard
          title="Scanner"
          subtitle="Skanim barkodi, loti, seriali ose lokacioni direkt nga telefoni."
        >
          <Button label="Hap Scanner" onPress={() => router.push('/scanner')} />
        </SectionCard>
      ) : null}

      <SectionCard
        title="Lidhja me ERP"
        subtitle="Ky app përdor të njëjtin backend, të njëjtat permissions dhe të njëjtat audit logs."
      >
        <Text style={{ color: '#475569', lineHeight: 22 }}>
          Veprimet e bëra këtu kalojnë në të njëjtat endpoint-e të NestJS që përdor edhe aplikacioni web.
        </Text>
      </SectionCard>
    </Screen>
  );
}
