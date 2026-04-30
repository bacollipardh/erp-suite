import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const LAST_ALERT_KEY = 'erp_mobile_last_operational_alert';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type OperationalAlerts = {
  blockedTasks: number;
  shortTasks: number;
  readyOrders: number;
  queuedDrafts: number;
  queuedPickerActions: number;
};

export async function ensureNotificationPermissions() {
  if (!Device.isDevice) {
    return {
      granted: false,
      message: 'Njoftimet push kërkojnë pajisje reale.',
    };
  }

  const current = await Notifications.getPermissionsAsync();
  const finalStatus =
    current.status === 'granted'
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') {
    return {
      granted: false,
      message: 'Leja për njoftime nuk është dhënë.',
    };
  }

  let expoPushToken: string | undefined;
  try {
    expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
  } catch {
    expoPushToken = undefined;
  }

  return {
    granted: true,
    expoPushToken,
    message: expoPushToken
      ? 'Njoftimet janë aktive.'
      : 'Njoftimet lokale janë aktive; push token do lidhet kur të konfigurohet Expo project id.',
  };
}

export async function notifyOperationalSummary(alerts: OperationalAlerts) {
  const total =
    alerts.blockedTasks +
    alerts.shortTasks +
    alerts.readyOrders +
    alerts.queuedDrafts +
    alerts.queuedPickerActions;

  if (total <= 0) return;

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') return;

  const signature = JSON.stringify(alerts);
  const now = Date.now();
  const raw = await SecureStore.getItemAsync(LAST_ALERT_KEY);
  if (raw) {
    try {
      const last = JSON.parse(raw) as { signature?: string; at?: number };
      if (last.signature === signature && now - Number(last.at ?? 0) < 30 * 60 * 1000) {
        return;
      }
    } catch {}
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'ERP Mobile',
      body: `${total} sinjale operative kërkojnë vëmendje.`,
      data: alerts,
    },
    trigger: null,
  });
  await SecureStore.setItemAsync(LAST_ALERT_KEY, JSON.stringify({ signature, at: now }));
}
