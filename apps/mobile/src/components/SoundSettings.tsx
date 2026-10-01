import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppIcon, Card, colors, spacing, typography, type AppIconName } from '@isla/ui';
import { useSoundSettings, type SoundSettings } from '../lib/notify';

type Row = {
  key: keyof SoundSettings;
  title: string;
  hint: string;
  icon: AppIconName;
};

const CUSTOMER_ROWS: Row[] = [
  { key: 'sounds', title: 'Sounds', hint: 'Play sounds for app alerts', icon: 'bell' },
  { key: 'chat', title: 'Chat messages', hint: 'Sound + banner for new messages', icon: 'message' },
  { key: 'orderUpdates', title: 'Order updates', hint: 'Rider assigned, on the way, delivered', icon: 'receipt' },
  { key: 'vibrate', title: 'Vibrate', hint: 'Vibrate with alerts', icon: 'phone' },
];

const RIDER_ROWS: Row[] = [
  { key: 'sounds', title: 'Sounds', hint: 'Play sounds for app alerts', icon: 'bell' },
  { key: 'riderRequest', title: 'Incoming request siren', hint: 'Loud alert + vibration for new pabili', icon: 'rider' },
  { key: 'chat', title: 'Chat messages', hint: 'Sound + banner for customer messages', icon: 'message' },
  { key: 'vibrate', title: 'Vibrate', hint: 'Vibrate with alerts', icon: 'phone' },
];

/** Shared sound/vibration preferences, customer Settings screen + rider Settings tab. */
export function SoundSettingsForm({ role }: { role: 'customer' | 'rider' }) {
  const { settings, update } = useSoundSettings();
  const rows = role === 'rider' ? RIDER_ROWS : CUSTOMER_ROWS;
  return (
    <Card>
      {rows.map((row, i) => {
        const disabled = row.key !== 'sounds' && !settings.sounds;
        return (
          <View key={row.key} style={[styles.row, i < rows.length - 1 && styles.divider]}>
            <View style={styles.icon}>
              <AppIcon name={row.icon} size={20} color={disabled ? colors.faint : colors.primary} />
            </View>
            <View style={styles.text}>
              <Text style={[styles.title, disabled && styles.dimmed]}>{row.title}</Text>
              <Text style={styles.hint}>{row.hint}</Text>
            </View>
            <Switch
              value={row.key === 'sounds' ? settings.sounds : settings.sounds && settings[row.key]}
              disabled={row.key !== 'sounds' && !settings.sounds}
              onValueChange={(v) => void update({ [row.key]: v })}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={settings.sounds ? colors.primary : colors.faint}
            />
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
  title: { ...typography.label, fontWeight: '700' },
  dimmed: { color: colors.faint },
  hint: { ...typography.caption },
});
