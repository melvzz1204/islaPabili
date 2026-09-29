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
    // Denied — in-app banners/toasts still work.
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
