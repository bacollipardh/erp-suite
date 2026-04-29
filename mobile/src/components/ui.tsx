import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { sentenceStatus } from '../lib/format';

const palette = {
  bg: '#F4F7FB',
  card: '#FFFFFF',
  border: '#D8E0EA',
  text: '#0F172A',
  subtle: '#64748B',
  primary: '#2553EB',
  success: '#0F9D58',
  warn: '#D97706',
  danger: '#DC2626',
  soft: '#E8EEFF',
};

export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const content = <View style={[styles.screen, style]}>{children}</View>;
  if (scroll) {
    return <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView>;
  }
  return content;
}

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={palette.subtle} {...props} style={[styles.input, props.style]} />;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const tone =
    variant === 'primary'
      ? styles.buttonPrimary
      : variant === 'danger'
        ? styles.buttonDanger
        : variant === 'ghost'
          ? styles.buttonGhost
          : styles.buttonSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, tone, disabled || loading ? styles.buttonDisabled : null]}
    >
      {loading ? <ActivityIndicator color={variant === 'ghost' ? palette.primary : '#FFFFFF'} /> : <Text style={[styles.buttonText, variant === 'ghost' ? styles.buttonGhostText : null]}>{label}</Text>}
    </Pressable>
  );
}

export function Badge({
  value,
  tone = 'neutral',
}: {
  value: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warn' | 'danger';
}) {
  const style =
    tone === 'primary'
      ? styles.badgePrimary
      : tone === 'success'
        ? styles.badgeSuccess
        : tone === 'warn'
          ? styles.badgeWarn
          : tone === 'danger'
            ? styles.badgeDanger
            : styles.badgeNeutral;
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{sentenceStatus(value)}</Text>
    </View>
  );
}

export function StatusBadge({ value }: { value?: string | null }) {
  const status = value ?? 'UNKNOWN';
  let tone: 'neutral' | 'primary' | 'success' | 'warn' | 'danger' = 'neutral';
  if (['POSTED', 'DONE', 'APPROVED', 'READY_FOR_DOCUMENT', 'DOCUMENT_CREATED', 'PICKED', 'SHIPPED'].includes(status)) tone = 'success';
  else if (['PENDING', 'SUBMITTED', 'WMS_ASSIGNED', 'PICKING', 'IN_PROGRESS'].includes(status)) tone = 'primary';
  else if (['BLOCKED', 'SHORT', 'REJECTED'].includes(status)) tone = 'warn';
  else if (['CANCELLED', 'FAILED', 'DAMAGED'].includes(status)) tone = 'danger';
  return <Badge value={status} tone={tone} />;
}

export function MetricTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button label="Provo Përsëri" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

export function LoadingState({ label = 'Duke ngarkuar...' }: { label?: string }) {
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={palette.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function TopTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.topHeader}>
      <Text style={styles.topTitle}>{title}</Text>
      {subtitle ? <Text style={styles.topSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  gap8: {
    gap: 8,
  },
  gap12: {
    gap: 12,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
    padding: 16,
    gap: 16,
  },
  scroll: {
    flexGrow: 1,
  },
  topHeader: {
    gap: 4,
  },
  topTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  topSubtitle: {
    color: palette.subtle,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  cardSubtitle: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 19,
  },
  cardBody: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.text,
    fontSize: 15,
  },
  button: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPrimary: {
    backgroundColor: palette.primary,
  },
  buttonSecondary: {
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: '#C8D5FF',
  },
  buttonGhost: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.border,
  },
  buttonDanger: {
    backgroundColor: palette.danger,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonGhostText: {
    color: palette.primary,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeNeutral: {
    backgroundColor: '#E8EDF3',
  },
  badgePrimary: {
    backgroundColor: '#DCE6FF',
  },
  badgeSuccess: {
    backgroundColor: '#DDF7E7',
  },
  badgeWarn: {
    backgroundColor: '#FFF0D8',
  },
  badgeDanger: {
    backgroundColor: '#FFE1E1',
  },
  metric: {
    flex: 1,
    minWidth: 110,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 4,
  },
  metricLabel: {
    color: palette.subtle,
    fontSize: 12,
  },
  metricValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyState: {
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  emptyHint: {
    color: palette.subtle,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3C1C1',
    backgroundColor: '#FFF2F2',
    padding: 16,
    gap: 12,
  },
  errorText: {
    color: palette.danger,
    lineHeight: 20,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    color: palette.subtle,
  },
});
