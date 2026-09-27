import { StyleSheet, Text, View } from 'react-native';
import { AppIcon, type AppIconName } from '../icons';
import { colors, radius, spacing, typography } from '../tokens';

type AuthHeaderProps = {
  icon: AppIconName;
  title: string;
  subtitle?: string;
  /** Use the orange Pabili accent medallion (rider / custom-order flows). */
  accent?: boolean;
};

/** Brand header for auth screens: medallion icon + display title + subtitle. */
export function AuthHeader({ icon, title, subtitle, accent = false }: AuthHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.medallion, accent && styles.medallionAccent]}>
        <AppIcon name={icon} size={32} />
      </View>
      <Text style={typography.display}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', gap: spacing.sm },
  medallion: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  medallionAccent: { backgroundColor: colors.accentSoft },
  subtitle: { ...typography.body, color: colors.muted },
});
