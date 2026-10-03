import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AppIcon, Button, Card, colors, radius, spacing, typography, type AppIconName } from '@isla/ui';

/** Landing steps, mirrors the Figma "How its works?" prototype timeline. */
export const HOW_IT_WORKS_STEPS: {
  title: string;
  body: string;
  icon: AppIconName;
  medallion: ViewStyle;
  tint: string;
}[] = [
  {
    title: 'Create a pabili list',
    body: 'Type what you need from any store in Marinduque.',
    icon: 'pabili',
    medallion: { backgroundColor: colors.primaryTint },
    tint: colors.primaryDeep,
  },
  {
    title: 'A rider accepts',
    body: 'An on-duty rider picks up your request in seconds.',
    icon: 'rider',
    medallion: { backgroundColor: colors.accentSoft },
    tint: colors.accentDark,
  },
  {
    title: 'Rider shops for you',
    body: 'They buy your items and confirm swaps by chat.',
    icon: 'cart',
    medallion: { backgroundColor: colors.primarySoft },
    tint: colors.primaryDeep,
  },
  {
    title: 'Rider delivers',
    body: 'Follow it from shop to doorstep in real time.',
    icon: 'route',
    medallion: { backgroundColor: colors.primaryTint },
    tint: colors.primary,
  },
  {
    title: 'Pay and rate',
    body: 'Cash or e-payment on arrival, then rate your rider.',
    icon: 'rating',
    medallion: { backgroundColor: colors.successSoft },
    tint: colors.successDark,
  },
];

const TRUST: { icon: AppIconName; label: string }[] = [
  { icon: 'shield', label: 'Verified riders' },
  { icon: 'timer', label: 'Live tracking' },
  { icon: 'wallet', label: 'Cash or e-payment' },
];

type Props = {
  onCreate: () => void;
};

/**
 * Premium prototype landing: warm hero card, icon timeline, big CTA plus a
 * trust row. Shared by the signed-in Home tab and the guest landing screen.
 */
export function HowItWorks({ onCreate }: Props) {
  return (
    <>
      <Card variant="tinted" style={styles.hero}>
        <View style={styles.heroMedallion}>
          <AppIcon name="pabili" size={28} color={colors.onPrimary} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Pabili na, hatid pa sa pinto mo.</Text>
          <Text style={styles.heroBody}>
            Send one list and a rider shops it across Marinduque, then delivers to your door.
          </Text>
        </View>
      </Card>

      <View style={styles.howWrap}>
        <Text style={styles.howTitle}>How it works?</Text>
        <View style={styles.steps}>
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepRail}>
                <View style={[styles.stepMedallion, step.medallion]}>
                  <AppIcon name={step.icon} size={20} color={step.tint} />
                </View>
                {i < HOW_IT_WORKS_STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.ctaWrap}>
        <Button title="Create Pabili List" onPress={onCreate} />
        <View style={styles.trustRow}>
          {TRUST.map((t) => (
            <View key={t.label} style={styles.trustItem}>
              <AppIcon name={t.icon} size={14} color={colors.primaryDeep} />
              <Text style={styles.trustLabel}>{t.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
  },
  heroMedallion: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 3 },
  heroTitle: { ...typography.title, fontSize: 19, color: colors.primaryDeep },
  heroBody: { ...typography.caption, color: colors.body },

  howWrap: { gap: spacing.md, paddingTop: spacing.sm },
  howTitle: { ...typography.heading, fontSize: 19 },
  steps: { gap: 0 },
  stepRow: { flexDirection: 'row', gap: spacing.md },
  stepRail: { width: 44, alignItems: 'center' },
  stepMedallion: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: { width: 2, flex: 1, minHeight: 14, backgroundColor: colors.hairline, marginVertical: 4 },
  stepText: { flex: 1, gap: 2, paddingBottom: spacing.base, paddingTop: 2 },
  stepTitle: { ...typography.subhead, fontWeight: '700' },
  stepBody: { ...typography.caption, color: colors.muted },

  ctaWrap: { paddingTop: spacing.sm, gap: spacing.sm },
  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.base },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustLabel: { ...typography.micro, color: colors.muted, fontWeight: '600' },
});
