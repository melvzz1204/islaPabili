import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon, Button, colors, radius, shadows, spacing, typography } from '@isla/ui';
import { useAppUpdate } from '../lib/appUpdate';

/**
 * Real-app style update sheet: version + "What's new" notes with a download
 * button. Mounted once at the root so it appears over any screen. Mandatory
 * releases (below min_build) hide the Later button.
 */
export function UpdatePrompt() {
  const { release, build, mandatory, updateNow, later } = useAppUpdate();
  if (!release) return null;

  const notes = release.notes
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.sheet}>
        <View style={styles.badge}>
          <AppIcon name="spark" size={26} color={colors.onPrimary} />
        </View>
        <Text style={styles.title}>Update available</Text>
        <View style={styles.versionRow}>
          <Text style={styles.version}>v{release.version}</Text>
          <Text style={styles.build}>build {release.build_number} · you have {build}</Text>
        </View>
        {notes.length > 0 ? (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>What&apos;s new</Text>
            {notes.map((n, i) => (
              <View key={i} style={styles.noteRow}>
                <View style={styles.dot} />
                <Text style={styles.note}>{n}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Button title="Download update" onPress={updateNow} />
        {mandatory ? (
          <Text style={styles.required}>This update is required to keep using IslaPabili.</Text>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Later" onPress={later} hitSlop={8}>
            <Text style={styles.later}>Later</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: spacing.base,
    paddingBottom: spacing.xl,
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    ...shadows.sheet,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.xxxl,
    borderWidth: 4,
    borderColor: colors.surface,
  },
  title: { ...typography.title, fontSize: 21 },
  versionRow: { alignItems: 'center', gap: 2 },
  version: { ...typography.subhead, fontWeight: '800', color: colors.primaryDeep },
  build: { ...typography.micro, color: colors.faint },
  notes: { alignSelf: 'stretch', gap: spacing.xs },
  notesTitle: { ...typography.label, fontWeight: '800' },
  noteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
  note: { ...typography.body, flex: 1 },
  required: { ...typography.caption, textAlign: 'center', color: colors.warnDark, fontWeight: '600' },
  later: { ...typography.label, color: colors.muted, fontWeight: '700', padding: spacing.xs },
});
