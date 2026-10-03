import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@isla/supabase';
import { AppIcon, colors, radius, spacing, typography } from '@isla/ui';

/**
 * Paper-list photo thumbnails + fullscreen viewer for a pabili order.
 * The bucket is private, so each path resolves to a short-lived signed URL
 * (readable by the customer who uploaded it and their assigned rider).
 */
export function ListPhotos({ paths }: { paths: string[] | null | undefined }) {
  const { client } = useAuth();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!paths || paths.length === 0) return;
    let active = true;
    void (async () => {
      const entries = await Promise.all(
        paths.map(async (p) => {
          const { data } = await client.storage.from('pabili-lists').createSignedUrl(p, 3600);
          return [p, data?.signedUrl ?? null] as const;
        }),
      );
      if (!active) return;
      const map: Record<string, string> = {};
      for (const [p, u] of entries) {
        if (u) map[p] = u;
      }
      setUrls(map);
    })();
    return () => {
      active = false;
    };
  }, [client, paths]);

  if (!paths || paths.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <AppIcon name="image" size={14} color={colors.primaryDeep} />
        <Text style={styles.headText}>
          Paper list photo{paths.length === 1 ? '' : 's'} · {paths.length}
        </Text>
      </View>
      <View style={styles.thumbs}>
        {paths.map((p) =>
          urls[p] ? (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel="View list photo fullscreen"
              onPress={() => setOpen(urls[p]!)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Image source={{ uri: urls[p] }} style={styles.thumb} />
            </Pressable>
          ) : (
            <View key={p} style={[styles.thumb, styles.thumbLoading]} />
          ),
        )}
      </View>
      <Modal
        visible={open !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(null)}
      >
        <View style={styles.viewer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setOpen(null)}
            style={({ pressed }) => [styles.viewerClose, pressed && styles.pressed]}
          >
            <AppIcon name="close" size={16} color={colors.onPrimary} />
          </Pressable>
          {open ? (
            <Image source={{ uri: open }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headText: { ...typography.caption, fontWeight: '700', color: colors.primaryDeep },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
  thumbLoading: { opacity: 0.5 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '92%', height: '80%' },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pressed: { opacity: 0.7 },
});
