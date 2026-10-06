import { useEffect, useMemo } from 'react';
import { useAuth } from '@isla/supabase';
import { useToast } from '@isla/ui';
import { CHANNEL_ORDERS, blip, cancelDeliveredReminder, getSoundSettings, notifyLocal, scheduleDeliveredReminder } from './notify';

/**
 * Customer order-update fanfare: every new inbox notification also fires an
 * in-app toast + tray notification with sound, so status changes (rider
 * assigned, on the way, delivered…) are impossible to miss.
 */
export function useOrderUpdateAlerts() {
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  const instanceId = useMemo(() => Math.random().toString(36).slice(2, 9), []);

  useEffect(() => {
    if (!profile) return;
    const channel = client
      .channel(`order-alerts-${profile.id}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const n = payload.new as { title: string; body: string; kind: string | null; order_id: string | null };
          // Chat rows already banner through the message alerts.
          if (n.kind === 'message') return;
          // Proof-of-receipt follow-ups: delivered re-nudges in 2h,
          // completed clears any pending nudge.
          if (n.order_id) {
            if (n.title.startsWith('Nadala na')) {
              const match = n.body.match(/order (\S+)/i);
              void scheduleDeliveredReminder(n.order_id, match?.[1] ?? n.order_id.slice(0, 8));
            } else if (n.title === 'Order completed') {
              void cancelDeliveredReminder(n.order_id);
            }
          }
          showToast({ message: `${n.title}, ${n.body}`, type: 'success', duration: 4200 });
          void (async () => {
            const prefs = await getSoundSettings();
            if (prefs.sounds && prefs.orderUpdates) {
              if (prefs.vibrate) blip();
              await notifyLocal({ channel: CHANNEL_ORDERS, title: n.title, body: n.body });
            }
          })();
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, profile, showToast, instanceId]);
}
