import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import {
  Button,
  MetricTile,
  Screen,
  SectionCard,
  TopTitle,
  uiStyles,
} from '../../src/components/ui';
import {
  canUseAgentApp,
  canUsePickerApp,
  hasPermission,
  PERMISSIONS,
} from '../../src/lib/permissions';
import { useAuth } from '../../src/providers/auth-provider';

export default function HomeScreen() {
  const router = useRouter();
  const { user, apiUrl, logout } = useAuth();

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
