import { useCallback, useEffect, useState } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SoundSettings = {
  /** Master switch for sounds. */
  sounds: boolean;
  /** Chat message banners + sound. */
  chat: boolean;
  /** Order status updates. */
  orderUpdates: boolean;
  /** Rider incoming-request siren (sound + insist vibration). */
  riderRequest: boolean;
  /** Vibration for alerts. */
  vibrate: boolean;
};

const KEY = 'isla-sound-settings';

export const DEFAULT_SOUNDS: SoundSettings = {
  sounds: true,
  chat: true,
  orderUpdates: true,
  riderRequest: true,
  vibrate: true,
};

export async function getSoundSettings(): Promise<SoundSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SOUNDS;
    return { ...DEFAULT_SOUNDS, ...(JSON.parse(raw) as Partial<SoundSettings>) };
  } catch {
    return DEFAULT_SOUNDS;
  }
}

export function useSoundSettings() {
  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SOUNDS);

  useEffect(() => {
    void getSoundSettings().then(setSettings);
  }, []);

  const update = useCallback(async (patch: Partial<SoundSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  return { settings, update };
}

// --- Channels ------------------------------------------------------------------

export const CHANNEL_ORDERS = 'isla-orders';
export const CHANNEL_CHAT = 'isla-chat';

/**
 * Call once at startup: permissions, Android channels (orders = max
 * importance with insistent vibration), foreground banner + sound.
 */
export async function initNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    // Denied, in-app banners/toasts still work.
  }
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
  });
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ORDERS, {
        name: 'Order alerts',
        description: 'Incoming requests and delivery updates',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 600, 250, 600, 250, 900],
        enableVibrate: true,
        showBadge: true,
      });
      await Notifications.setNotificationChannelAsync(CHANNEL_CHAT, {
        name: 'Messages',
        description: 'Rider and customer chat',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 100, 250],
        enableVibrate: true,
      });
    } catch {
      // Channels are best-effort on some builds.
    }
  }
}

type LocalAlert = {
  channel: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

/** Tray notification (also visible when the app is backgrounded). */
export async function notifyLocal(alert: LocalAlert): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: alert.title, body: alert.body, sound: 'default', data: alert.data ?? {} },
      trigger: null,
    });
  } catch {
    // Tray is best-effort; in-app banners still fire.
  }
}

// --- Daily 11AM craving promo + delivered reminders ---------------------------
// Local-scheduled (works without server cron): the 11AM lunch nudge fires
// every day at 11:00 local time, and a delivered order re-nudges the
// customer 2h later if they have not tapped "Natanggap ko na".

const CRAVING_ID_KEY = 'isla-craving-sched-id';
const DELIVERED_REMINDER_KEY = 'isla-delivered-reminders';

const CRAVING_COPY: { title: string; body: string }[] = [
  { title: '11AM na! Gutom ka na ba? 🍚', body: 'Anong lunch cravings mo? Pabili ka na — rider ang bahala.' },
  { title: 'Lunch break malapit na 🍗', body: 'Order na bago mag-lunch rush. Mabilis ang rider ngayon.' },
  { title: 'Anong ulam today? 🍲', body: 'Pabili ng paborito mo sa IslaPabili — door-to-door, COD pa.' },
  { title: 'Merienda o lunch? 🥤', body: 'Isang tap lang, darating ang cravings mo. Open Shop na!' },
  { title: 'Gutom check! 👀', body: 'Huwag magpalipas ng gutom — magpabili ka na bago 12PM rush.' },
  { title: 'Craving alert 🍔', body: 'Masarap kumain nang busog. Order na, sagot na ng rider ang pila.' },
  { title: 'Tanghalian na! 🐟', body: 'Fresh, mainit, delivered. Magpabili ka na sa IslaPabili.' },
];

/** Daily 11:00 local-time lunch nudge, ad-style. Idempotent per install. */
export async function scheduleDailyCraving(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const existing = await AsyncStorage.getItem(CRAVING_ID_KEY);
    if (existing) return;
    const day = Math.floor(Date.now() / 86400000);
    const copy = CRAVING_COPY[day % CRAVING_COPY.length]!;
    let id: string | null = null;
    try {
      id = await Notifications.scheduleNotificationAsync({
        content: { title: copy.title, body: copy.body, sound: 'default', data: { kind: 'promo' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 11, minute: 0 },
      });
    } catch {
      // Older SDKs accept the legacy calendar shape.
      id = await Notifications.scheduleNotificationAsync({
        content: { title: copy.title, body: copy.body, sound: 'default', data: { kind: 'promo' } },
        trigger: { hour: 11, minute: 0, repeats: true } as never,
      });
    }
    if (id) await AsyncStorage.setItem(CRAVING_ID_KEY, id);
  } catch {
    // Promo nudge is best-effort.
  }
}

async function readDeliveredReminders(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(DELIVERED_REMINDER_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** One-time follow-up nudge if a delivered order sits unconfirmed. */
export async function scheduleDeliveredReminder(orderId: string, orderNumber: string): Promise<void> {
  if (Platform.OS === 'web' || !orderId) return;
  try {
    const map = await readDeliveredReminders();
    if (map[orderId]) return;
    const body = `Order ${orderNumber} naghihintay pa ng confirm mo. Tap "Natanggap ko na" pag nakuha mo na.`;
    let id: string | null = null;
    try {
      id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Nadala na ba? Pakiconfirm 👀',
          body,
          sound: 'default',
          data: { orderId, kind: 'status' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2 * 60 * 60,
        },
      });
    } catch {
      id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Nadala na ba? Pakiconfirm 👀',
          body,
          sound: 'default',
          data: { orderId, kind: 'status' },
        },
        trigger: { seconds: 2 * 60 * 60 } as never,
      });
    }
    if (id) {
      map[orderId] = id;
      await AsyncStorage.setItem(DELIVERED_REMINDER_KEY, JSON.stringify(map));
    }
  } catch {
    // Reminder is best-effort.
  }
}

/** Drop the pending follow-up once the customer confirms receipt. */
export async function cancelDeliveredReminder(orderId: string): Promise<void> {
  if (Platform.OS === 'web' || !orderId) return;
  try {
    const map = await readDeliveredReminders();
    const id = map[orderId];
    if (!id) return;
    delete map[orderId];
    await AsyncStorage.setItem(DELIVERED_REMINDER_KEY, JSON.stringify(map));
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  } catch {
    // Ignore.
  }
}

// --- Haptics -------------------------------------------------------------------

/** Insistent rider-request siren: long vibration bursts + heavy taps. */
export function sirenVibrate(): void {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 700, 300, 700, 300, 1000], false);
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Haptics unavailable on this device.
  }
}

export function blip(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore.
  }
}

export function stopVibration(): void {
  try {
    if (Platform.OS === 'android') Vibration.cancel();
  } catch {
    // Ignore.
  }
}
