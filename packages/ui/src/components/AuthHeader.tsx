import { StyleSheet, Text, View } from 'react-native';
import { AppIcon, type AppIconName } from '../icons';
import { colors, radius, spacing, typography } from '../tokens';

type AuthHeaderProps = {
  icon: AppIconName;
  title: string;
  subtitle?: string;
  /** Use the orange Pabili accent medallion (rider / custom-order flows). */
  accent?: boolean;
  /** Center the medallion + copy (soft auth-screen hero). Defaults to left. */
  align?: 'left' | 'center';
};

/** Brand header for auth screens: medallion icon + display title + subtitle. */
export function AuthHeader({ icon, title, subtitle, accent = false, align = 'left' }: AuthHeaderProps) {
  const centered = align === 'center';
  return (
    <View style={[styles.wrap, centered && styles.wrapCenter]}>
      <View style={[styles.medallion, accent && styles.medallionAccent]}>
        <AppIcon name={icon} size={32} />
      </View>
      <Text style={[typography.display, centered && styles.textCenter]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, centered && styles.textCenter]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', gap: spacing.sm },
  wrapCenter: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
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
