import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

export type OtaStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'error';

/**
 * Over-the-air updates (EAS Update): JS-only changes download in the
 * background and apply on restart — no APK reinstall. Native changes
 * (permissions, new native deps, SDK upgrades) still need a store build
 * via the app_releases flow in UpdatePrompt.
 */
export function useOtaUpdate() {
  const [status, setStatus] = useState<OtaStatus>('idle');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;
    let alive = true;
    void (async () => {
      setStatus('checking');
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!alive) return;
        if (check.isAvailable) {
          setStatus('downloading');
          await Updates.fetchUpdateAsync();
          if (alive) setStatus('ready');
        } else {
          setStatus('idle');
        }
      } catch {
        if (alive) setStatus('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const restart = useCallback(async () => {
    await Updates.reloadAsync();
  }, []);

  const later = useCallback(() => setDismissed(true), []);

  return { status, showPrompt: status === 'ready' && !dismissed, restart, later };
}
