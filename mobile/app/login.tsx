import { Redirect } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Button,
  Input,
  Label,
  Screen,
  SectionCard,
  TopTitle,
} from '../src/components/ui';
import { resolveApiUrl } from '../src/lib/api';
import { resolveHomePath } from '../src/lib/permissions';
import { useAuth } from '../src/providers/auth-provider';

const DEMO_USERS = [
  { label: 'Agjent', email: 'sales@erp.local', password: 'Admin123!' },
  { label: 'Picker', email: 'picker@erp.local', password: 'Admin123!' },
  { label: 'Menaxher', email: 'manager@erp.local', password: 'Admin123!' },
];

export default function LoginScreen() {
  const { user, login, loading, apiUrl: storedApiUrl } = useAuth();
  const [apiUrl, setApiUrl] = useState(storedApiUrl || resolveApiUrl(null));
  const [email, setEmail] = useState('sales@erp.local');
  const [password, setPassword] = useState('Admin123!');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedUrl = useMemo(() => resolveApiUrl(apiUrl), [apiUrl]);

  if (!loading && user) {
    return <Redirect href={resolveHomePath(user) as any} />;
  }

  async function handleLogin() {
    setSubmitting(true);
    setError(null);
    try {
      await login({ apiUrl, email, password });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
      >
        <TopTitle
          title="ERP Mobile"
          subtitle="Aplikacion i vërtetë për Agjentin dhe Picker-in, i lidhur direkt me backend-in aktual."
        />

        <SectionCard
          title="Hyr në Sistem"
          subtitle="Vendos URL-në e backend-it NestJS dhe hyr me përdoruesin tënd."
        >
          <View style={styles.form}>
            <View>
              <Label>API URL</Label>
              <Input
                value={apiUrl}
                onChangeText={setApiUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://10.10.69.9:3000 ose http://10.10.69.9:3000/api"
              />
              <Text style={styles.hint}>Do përdoret automatikisht: {normalizedUrl}</Text>
            </View>
            <View>
              <Label>Email</Label>
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>
            <View>
              <Label>Fjalëkalimi</Label>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="Hyr në ERP Mobile"
              onPress={handleLogin}
              loading={submitting}
            />
          </View>
        </SectionCard>

        <SectionCard
          title="Hyrje të Shpejta"
          subtitle="Për demo në ambientin aktual, mund t’i mbushësh me një prekje."
        >
          <View style={styles.quickRow}>
            {DEMO_USERS.map((entry) => (
              <Pressable
                key={entry.email}
                onPress={() => {
                  setEmail(entry.email);
                  setPassword(entry.password);
                }}
                style={styles.quickButton}
              >
                <Text style={styles.quickLabel}>{entry.label}</Text>
                <Text style={styles.quickValue}>{entry.email}</Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        <SectionCard
          title="URL për pajisje"
          subtitle="Në telefon real përdor IP-në lokale të kompjuterit ku po ec backend-i me Docker."
        >
          <Text style={styles.tip}>
            Android emulator: `http://10.0.2.2:3000`
          </Text>
          <Text style={styles.tip}>
            iPhone simulator: `http://localhost:3000`
          </Text>
          <Text style={styles.tip}>
            Telefon real: `http://IP-E-KOMPJUTERIT:3000`
          </Text>
          <Text style={styles.tip}>
            App-i ia shton vetë `/api` në fund nëse nuk e shkruan.
          </Text>
        </SectionCard>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  hint: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 12,
  },
  error: {
    color: '#DC2626',
    lineHeight: 20,
  },
  quickRow: {
    gap: 10,
  },
  quickButton: {
    borderWidth: 1,
    borderColor: '#D8E0EA',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickValue: {
    color: '#64748B',
    fontSize: 12,
  },
  tip: {
    color: '#334155',
    lineHeight: 22,
  },
});
