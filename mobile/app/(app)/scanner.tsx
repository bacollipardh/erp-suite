import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Screen,
  SectionCard,
  TopTitle,
} from '../../src/components/ui';
import { apiRequest } from '../../src/lib/api';
import { formatQty } from '../../src/lib/format';
import type { ScanPayload } from '../../src/types';
import { useAuth } from '../../src/providers/auth-provider';

export default function ScannerScreen() {
  const { apiUrl, token } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [result, setResult] = useState<ScanPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runLookup = useCallback(
    async (value: string) => {
      if (!value.trim()) return;
      setBusy(true);
      setError(null);
      setLastCode(value);
      try {
        const payload = await apiRequest<ScanPayload>(apiUrl, '/wms/scan', {
          token,
          query: { code: value.trim() },
        });
        setResult(payload);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Scan failed');
      } finally {
        setBusy(false);
      }
    },
    [apiUrl, token],
  );

  return (
    <Screen scroll>
      <TopTitle
        title="Scanner"
        subtitle="Skanon barkode artikulli, lokacioni, loti ose seriali dhe e pyet direkt WMS-in."
      />

      <SectionCard title="Kërkim Manual">
        <Input
          value={code}
          onChangeText={setCode}
          placeholder="Barcode, code, lot ose serial..."
          onSubmitEditing={() => void runLookup(code)}
        />
        <Button label="Kërko" onPress={() => void runLookup(code)} loading={busy} />
      </SectionCard>

      {!permission?.granted ? (
        <SectionCard title="Leja e Kamerës" subtitle="Na duhet leja vetëm për skanimin nga telefoni.">
          <Button label="Lejo Kamerën" onPress={() => void requestPermission()} />
        </SectionCard>
      ) : (
        <SectionCard title="Skanim me Kamerë" subtitle="Mbahu mbi barkod dhe sistemi e lexon automatikisht.">
          <View style={{ height: 280, overflow: 'hidden', borderRadius: 16 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={busy ? undefined : ({ data }) => {
                setCode(data);
                void runLookup(data);
              }}
            />
          </View>
        </SectionCard>
      )}

      {busy ? <LoadingState label="Duke kërkuar në WMS..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {result ? (
        <>
          <SectionCard
            title="Rezultati i Scan-it"
            subtitle={lastCode ? `Kodi i lexuar: ${lastCode}` : undefined}
          >
            <Text style={{ color: '#334155' }}>
              Artikuj: {result.items.length} | Lokacione: {result.locations.length} | Stock rows: {result.stocks.length}
            </Text>
          </SectionCard>

          <SectionCard title="Artikuj">
            {result.items.length ? (
              result.items.map((item) => (
                <View key={item.id} style={{ gap: 4 }}>
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                    {item.code} | {item.name}
                  </Text>
                  <Text style={{ color: '#64748B' }}>{item.barcode ?? '-'}</Text>
                </View>
              ))
            ) : (
              <EmptyState title="Nuk u gjet artikull" />
            )}
          </SectionCard>

          <SectionCard title="Lokacione">
            {result.locations.length ? (
              result.locations.map((location) => (
                <View key={location.id} style={{ gap: 4 }}>
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                    {location.code} | {location.zone ?? '-'}
                  </Text>
                  <Text style={{ color: '#64748B' }}>
                    {location.warehouse?.name ?? '-'} | {location.barcode ?? '-'}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyState title="Nuk u gjet lokacion" />
            )}
          </SectionCard>

          <SectionCard title="Stoku i lidhur">
            {result.stocks.length ? (
              result.stocks.map((stock) => (
                <View key={stock.id} style={{ gap: 4 }}>
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                    {stock.item?.code ?? '-'} | {stock.item?.name ?? '-'}
                  </Text>
                  <Text style={{ color: '#334155' }}>
                    Qty {formatQty(stock.qtyOnHand)} | Loc {stock.location?.code ?? '-'}
                  </Text>
                  <Text style={{ color: '#64748B' }}>
                    Lot {stock.lotCode ?? '-'} | Serial {stock.serialNo ?? '-'}
                  </Text>
                </View>
              ))
            ) : (
              <EmptyState title="Nuk u gjet stock row" />
            )}
          </SectionCard>
        </>
      ) : null}
    </Screen>
  );
}
