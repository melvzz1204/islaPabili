import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, type Database } from '@isla/supabase';

export type AppRelease = Database['public']['Tables']['app_releases']['Row'];

const currentBuild = (): number => {
  if (Platform.OS === 'web') return 0;
  return Number.parseInt(Application.nativeBuildVersion ?? '0', 10) || 0;
};

/**
 * Real-app style update check: compares the installed native build against
 * the latest published `app_releases` row. Shows the "What's new" sheet when
 * a newer build with a download link exists; builds below `min_build` cannot
 * be dismissed. "Later" is remembered per build.
 */
export function useAppUpdate() {
  const { client } = useAuth();
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const build = currentBuild();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    void (async () => {
      const { data } = await client
        .from('app_releases')
        .select('*')
        .eq('platform', Platform.OS)
        .eq('is_active', true)
        .order('build_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active || !data) return;
      const rel = data as AppRelease;
      if (!rel.apk_url || rel.build_number <= build) return;
      const skipped = await AsyncStorage.getItem(`update-skipped-${rel.build_number}`).catch(() => null);
      if (!active) return;
      if (!skipped || build < rel.min_build) setRelease(rel);
    })();
    return () => {
      active = false;
    };
  }, [client, build]);

  const mandatory = !!release && build < release.min_build;

  const later = () => {
    if (!release || mandatory) return;
    void AsyncStorage.setItem(`update-skipped-${release.build_number}`, '1').catch(() => undefined);
    setDismissed(true);
  };

  const updateNow = () => {
    if (release?.apk_url) void Linking.openURL(release.apk_url);
  };

  return { release: dismissed ? null : release, build, mandatory, updateNow, later };
}
