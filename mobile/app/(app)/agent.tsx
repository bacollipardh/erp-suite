import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import {
  ErrorState,
  LoadingState,
  MetricTile,
  Screen,
  SectionCard,
  TopTitle,
  Button,
  uiStyles,
} from '../../src/components/ui';
import { apiList } from '../../src/lib/api';
import type { AgentOrder } from '../../src/types';
import { useAuth } from '../../src/providers/auth-provider';

export default function AgentDashboardScreen() {
  const router = useRouter();
  const { apiUrl, token, user } = useAuth();
  const [orders, setOrders] = useState<AgentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiList<AgentOrder>(apiUrl, '/agent-orders', {
        token,
        query: { limit: 50 },
      });
      setOrders(result);
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

  const total = orders.length;
  const ready = orders.filter((entry) => entry.status === 'READY_FOR_DOCUMENT').length;
  const inWms = orders.filter((entry) => ['WMS_ASSIGNED', 'PICKING'].includes(entry.status)).length;
  const created = orders.filter((entry) => entry.status === 'DOCUMENT_CREATED').length;

  return (
    <Screen scroll>
      <TopTitle
        title={`Mirë se erdhe, ${user?.fullName?.split(' ')[0] ?? 'Agjent'}`}
        subtitle="Pamje e shpejtë e orders operative dhe gatishmërisë për dokument."
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!loading && !error ? (
        <>
          <View style={uiStyles.wrapRow}>
            <MetricTile label="Orders" value={total} />
            <MetricTile label="Në WMS" value={inWms} />
            <MetricTile label="Gati për Dokument" value={ready} />
            <MetricTile label="Dokument i Krijuar" value={created} />
          </View>

          <SectionCard
            title="Shkurtore"
            subtitle="Hyr direkt te lista operative ose te skaneri."
          >
            <Button label="Hap Agent Orders" onPress={() => router.push('/agent-orders')} />
            <Button label="Hap Scanner" variant="secondary" onPress={() => router.push('/scanner')} />
          </SectionCard>
        </>
      ) : null}
    </Screen>
  );
}
