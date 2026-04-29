import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/providers/auth-provider';

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen name="home" options={{ title: 'ERP Mobile' }} />
      <Stack.Screen name="agent" options={{ title: 'Agjenti' }} />
      <Stack.Screen name="agent-orders" options={{ title: 'Agent Orders' }} />
      <Stack.Screen name="agent-orders/new" options={{ title: 'Order i Ri' }} />
      <Stack.Screen name="picker" options={{ title: 'Picker' }} />
      <Stack.Screen name="picker-tasks" options={{ title: 'Detyrat WMS' }} />
      <Stack.Screen name="picker-tasks/[id]" options={{ title: 'Workflow Picker' }} />
      <Stack.Screen name="scanner" options={{ title: 'Scanner' }} />
    </Stack>
  );
}
