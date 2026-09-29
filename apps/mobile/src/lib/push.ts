import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { Supabase } from '@isla/supabase';

export type PushKind = 'pabili' | 'message' | 'status';

/**
 * Registers this device for server-side wake-up pushes. Physical devices
 * only; safe to call on every sign-in (upsert by user).
 */
export async function registerPushToken(client: Supabase, userId: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = typeof data === 'string' ? data : (data as unknown as { data?: unknown } | null)?.data;
    if (!token || typeof token !== 'string') return;
    await client.from('push_tokens').upsert(
      { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  } catch {
    // Push registration is best-effort; realtime + tray still work in-app.
  }
}

/**
 * Asks the push-send edge function to wake the *other* side (killed or
 * backgrounded apps). Fire-and-forget — the sender's UI never waits on it.
 */
export async function invokePush(
  client: Supabase,
  orderId: string,
  kind: PushKind,
  extra?: { title?: string; body?: string },
): Promise<void> {
  try {
    await client.functions.invoke('push-send', {
      body: { order_id: orderId, kind, ...extra },
    });
  } catch {
    // Best-effort; in-app realtime banners already fired.
  }
}
