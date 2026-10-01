import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppIcon, brandCopy, colors, radius, shadows, spacing, typography, type AppIconName } from '@isla/ui';
import { Button } from '@isla/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export const WELCOME_SEEN_KEY = 'isla-welcome-seen-v1';

export async function markWelcomeSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1');
  } catch {
    // Non-fatal: welcome simply shows again next launch.
  }
}

type Slide = {
  key: string;
  icon: AppIconName;
  iconBg: string;
  iconColor: string;
  halo: string;
  title: string;
  body: string;
};

/**
 * Welcome carousel, IslaPabili take on the reference screenshot.
 *
 * Reference: 3-phone food-delivery intro (illustration → dots → bold title →
 * gray subtitle → orange "Get Started" → SKIP / NEXT footer on a warm canvas).
 * Adapted to Tropical Premium: teal + orange on `bg`, AppIcon spot
 * illustrations (no binary assets), Taglish copy for pabili (not food-only).
 */
const SLIDES: Slide[] = [
  {
    key: 'pabili',
    icon: 'storefront',
    iconBg: colors.primarySoft,
    iconColor: colors.primaryDeep,
    halo: colors.primaryTint,
    title: brandCopy.welcomePabiliTitle,
    body: brandCopy.welcomePabiliBody,
  },
  {
    key: 'swift',
    icon: 'scooter',
    iconBg: colors.accentSoft,
    iconColor: colors.accentDark,
    halo: colors.surfaceMuted,
    title: brandCopy.welcomeSwiftTitle,
    body: brandCopy.welcomeSwiftBody,
  },
  {
    key: 'track',
    icon: 'route',
    iconBg: colors.primarySoft,
    iconColor: colors.primaryDeep,
    halo: colors.surfaceSunken,
    title: brandCopy.welcomeTrackTitle,
    body: brandCopy.welcomeTrackBody,
  },
];

export default function WelcomeOnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const width = Dimensions.get('window').width;
  const isLast = index === SLIDES.length - 1;

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
      setIndex(clamped);
      listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
    },
    [width],
  );

  const finish = useCallback(() => {
    void markWelcomeSeen();
    onDone();
  }, [onDone]);

  const renderItem: ListRenderItem<Slide> = useCallback(
    ({ item }) => (
      <View style={[styles.slide, { width }]}>
        {/* Spot illustration: halo + tinted tile + glyph, mirrors the
            screenshot's top-art slot without image assets. */}
        <View style={[styles.halo, { backgroundColor: item.halo }]}>
          <View style={[styles.tile, { backgroundColor: item.iconBg }]}>
            <AppIcon name={item.icon} size={72} color={item.iconColor} />
          </View>
          <View style={styles.haloDotA} />
          <View style={styles.haloDotB} />
        </View>

        <View style={styles.dots} accessibilityRole="adjustable" accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </View>
    ),
    [index, width],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / width);
          if (Number.isFinite(next)) setIndex(Math.max(0, Math.min(SLIDES.length - 1, next)));
        }}
      />

      <View style={styles.footer}>
        {/* Screenshot parity: single orange CTA ("Get Started" on last slide). */}
        <Button
          title={isLast ? 'Get Started' : 'Next'}
          variant="accent"
          onPress={() => (isLast ? finish() : goTo(index + 1))}
        />
        <View style={styles.skipRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={finish} hitSlop={12}>
            <Text style={styles.skipText}>SKIP</Text>
          </Pressable>
          {!isLast ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next slide"
              onPress={() => goTo(index + 1)}
              hitSlop={12}
            >
              <Text style={styles.nextText}>NEXT</Text>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  slide: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xxl, paddingTop: spacing.xxxl },
  halo: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  tile: {
    width: 148,
    height: 148,
    borderRadius: radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.raised,
  },
  haloDotA: {
    position: 'absolute',
    top: 28,
    right: 40,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accentSoft,
  },
  haloDotB: {
    position: 'absolute',
    bottom: 36,
    left: 34,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primarySoft,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: spacing.lg },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.borderStrong, opacity: 0.6 },
  dotActive: { width: 22, backgroundColor: colors.primary, opacity: 1 },
  title: { ...typography.title, textAlign: 'center', marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  footer: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg, gap: spacing.md },
  skipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skipText: { ...typography.label, color: colors.faint, letterSpacing: 0.6 },
  nextText: { ...typography.label, color: colors.text, letterSpacing: 0.6 },
});
