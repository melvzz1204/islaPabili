import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
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
    title: 'Browse live stores',
    body: 'Find tindahan near you and add items to cart.',
    icon: 'storefront',
    medallion: { backgroundColor: colors.primaryTint },
    tint: colors.primaryDeep,
  },
  {
    title: 'Store prepares your order',
    body: 'The store confirms prices and packs your items.',
    icon: 'package',
    medallion: { backgroundColor: colors.accentSoft },
    tint: colors.accentDark,
  },
  {
    title: 'Claim with your code',
    body: 'Show your claim code at the counter. Pickup yourself or send a rider.',
    icon: 'receipt',
    medallion: { backgroundColor: colors.primarySoft },
    tint: colors.primaryDeep,
  },
  {
    title: 'Or send a pabili list',
    body: 'No store? Type what you need from anywhere in Marinduque.',
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

type Props = {
  onCreate: () => void;
  onBrowse: () => void;
};

/**
 * Premium prototype landing: warm hero card, live rider strip, auto-cycling
 * (and tappable) icon timeline, big CTA plus a trust row. Shared by the
 * signed-in Home tab and the guest landing screen.
 */
export function HowItWorks({ onCreate, onBrowse }: Props) {
  const [active, setActive] = useState(0);

  // Staggered entrance: hero, then each step, then the CTA.
  const heroA = useRef(new Animated.Value(0)).current;
  const stepAs = useRef(HOW_IT_WORKS_STEPS.map(() => new Animated.Value(0))).current;
  const ctaA = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroA, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      ...stepAs.map((v, i) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 450,
          delay: 200 + i * 110,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
      Animated.timing(ctaA, {
        toValue: 1,
        duration: 450,
        delay: 200 + stepAs.length * 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroA, ctaA, stepAs]);

  // Spotlight cycles through the steps; tapping one jumps straight to it.
  useEffect(() => {
    const t = setInterval(() => {
      setActive((a) => (a + 1) % HOW_IT_WORKS_STEPS.length);
    }, 2600);
    return () => clearInterval(t);
  }, []);

  // Smooth medallion zoom toward the spotlighted step.
  const spotAs = useRef(HOW_IT_WORKS_STEPS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    spotAs.forEach((v, i) => {
      Animated.timing(v, {
        toValue: i === active ? 1 : 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [active, spotAs]);

  return (
    <>
      <Animated.View style={{ opacity: heroA }}>
        <Card variant="tinted" style={styles.hero}>
          <View style={styles.heroMedallion}>
            <AppIcon name="pabili" size={28} color={colors.onPrimary} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Pabili na, hatid pa sa pinto mo.</Text>
            <Text style={styles.heroBody}>
              Browse live stores across Marinduque, or send one list and a rider shops it for you.
            </Text>
          </View>
        </Card>
      </Animated.View>

      <View style={styles.howWrap}>
        <Text style={styles.howTitle}>How it works?</Text>
        <View style={styles.steps}>
          {HOW_IT_WORKS_STEPS.map((step, i) => {
            const enter = stepAs[i]!;
            const spotlight = spotAs[i]!;
            const isActive = i === active;
            return (
              <Animated.View
                key={step.title}
                style={{
                  opacity: enter,
                  transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${step.title}: ${step.body}`}
                  onPress={() => setActive(i)}
                  style={({ pressed }) => [styles.stepRow, pressed && styles.pressed]}
                >
                  <View style={styles.stepRail}>
                    <Animated.View
                      style={[
                        styles.stepMedallion,
                        step.medallion,
                        isActive && styles.stepMedallionActive,
                        {
                          transform: [
                            { scale: spotlight.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
                          ],
                        },
                      ]}
                    >
                      <AppIcon name={step.icon} size={20} color={isActive ? colors.onPrimary : step.tint} />
                    </Animated.View>
                    {i < HOW_IT_WORKS_STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
                  </View>
                  <View style={styles.stepText}>
                    <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>{step.title}</Text>
                    <Text style={styles.stepBody}>{step.body}</Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>

      <Animated.View style={{ opacity: ctaA }}>
        <View style={styles.ctaWrap}>
          <Button title="Browse stores" onPress={onBrowse} />
          <Button title="Create Pabili List" variant="secondary" onPress={onCreate} />
        </View>
      </Animated.View>
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
  stepMedallionActive: { backgroundColor: colors.primary },
  stepLine: { width: 2, flex: 1, minHeight: 14, backgroundColor: colors.hairline, marginVertical: 4 },
  stepText: { flex: 1, gap: 2, paddingBottom: spacing.base, paddingTop: 2 },
  stepTitle: { ...typography.subhead, fontWeight: '700' },
  stepTitleActive: { color: colors.primaryDeep },
  stepBody: { ...typography.caption, color: colors.muted },

  ctaWrap: { paddingTop: spacing.sm, gap: spacing.sm },

  pressed: { opacity: 0.7 },
});
