import { Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
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
import { apiList } from '../../src/lib/api';
import { formatDateTime, formatQty } from '../../src/lib/format';
import type { AgentOrder } from '../../src/types';
import { useAuth } from '../../src/providers/auth-provider';

const FILTERS = ['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'WMS_ASSIGNED', 'PICKING', 'READY_FOR_DOCUMENT', 'DOCUMENT_CREATED'];

export default function AgentOrdersScreen() {
  const router = useRouter();
  const { apiUrl, token, logout } = useAuth();
  const [orders, setOrders] = useState<AgentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiList<AgentOrder>(apiUrl, '/agent-orders', {
        token,
        query: {
          search,
          status: status === 'ALL' ? undefined : status,
          limit: 80,
        },
      });
      setOrders(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, search, status, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen scroll>
      <TopTitle
        title="Agent Orders"
        subtitle="Lista operative e orders të agjentit me statusin e WMS dhe dokumentit."
      />

      <SessionActions onHome={() => router.push('/home')} onLogout={() => void logout()} />

      <SectionCard title="Veprim i Ri" subtitle="Krijo porosi të re nga telefoni.">
        <Pressable
          onPress={() => router.push('/agent-orders/new')}
          style={{
            backgroundColor: '#2553EB',
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }}>
            Krijo Order të Ri
          </Text>
        </Pressable>
      </SectionCard>

      <SectionCard title="Kërko dhe filtro">
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Nr. order, klient, objekt, magazinë..."
          onSubmitEditing={() => void load()}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((entry) => (
            <Pressable
              key={entry}
              onPress={() => setStatus(entry)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: status === entry ? '#2553EB' : '#D8E0EA',
                backgroundColor: status === entry ? '#E8EEFF' : '#FFFFFF',
              }}
            >
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>{entry === 'ALL' ? 'Të Gjitha' : entry}</Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!loading && !error && orders.length === 0 ? (
        <EmptyState title="Nuk u gjet asnjë order" hint="Provo me filtër tjetër ose hiqe tekstin e kërkimit." />
      ) : null}

      {!loading && !error
        ? orders.map((order) => (
            (() => {
              const lines = Array.isArray(order.lines) ? order.lines : [];
              const totalQty = lines.reduce((sum, line) => sum + Number(line.qty ?? 0), 0);
              return (
            <Link key={order.id} href={`/agent-orders/${order.id}` as any} asChild>
              <Pressable
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#D8E0EA',
                  padding: 16,
                  gap: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                      {order.orderNo}
                    </Text>
                    <Text style={{ color: '#64748B' }}>
                      {order.customer?.name ?? '-'}
                      {order.customerObject?.name ? ` / ${order.customerObject.name}` : ''}
                    </Text>
                  </View>
                  <StatusBadge value={order.status} />
                </View>
                <Text style={{ color: '#334155' }}>
                  {order.orderType} | Prioriteti {order.priority}
                </Text>
                <Text style={{ color: '#334155' }}>
                  {lines.length} rreshta | Sasia totale {formatQty(totalQty)}
                </Text>
                <Text style={{ color: '#64748B', fontSize: 12 }}>
                  Data: {formatDateTime(order.docDate ?? null)}
                </Text>
              </Pressable>
            </Link>
              );
            })()
          ))
        : null}
    </Screen>
  );
}
