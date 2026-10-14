import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@isla/supabase';
import {
  AppIcon,
  Button,
  Card,
  Screen,
  colors,
  radius,
  shadows,
  spacing,
  typography,
  type AppIconName,
} from '@isla/ui';
import { HowItWorks } from '../components/HowItWorks';
import { BrandLogo } from '../components/BrandLogo';
import type { RootNavProp, TabScreen } from '../navigation/types';

type Props = TabScreen<'Shop'>;

type Way = {
  key: string;
  /** Route pushed when the card is tapped. */
  route: 'Market' | 'PabiliCreate';
  icon: AppIconName;
  medallionBg: string;
  medallionFg: string;
  title: string;
  body: string;
};

/** The two ways to order: browse a store, or send a pabili list. */
const WAYS: Way[] = [
  {
    key: 'store',
    route: 'Market',
    icon: 'storefront',
    medallionBg: colors.primaryTint,
    medallionFg: colors.primaryDeep,
    title: 'Sa tindahan',
    body: 'Pumili ng items, pickup o delivery.',
  },
  {
    key: 'pabili',
    route: 'PabiliCreate',
    icon: 'pabili',
    medallionBg: colors.accentSoft,
    medallionFg: colors.accentDark,
    title: 'Pabili list',
    body: 'I-type ang kailangan, kami na bibili.',
  },
];

/** Small trust chip used under the hero CTA. */
function TrustChip({ icon, label }: { icon: AppIconName; label: string }) {
  return (
    <View style={styles.trustChip}>
      <AppIcon name={icon} size={14} color={colors.muted} />
      <Text style={styles.trustText}>{label}</Text>
    </View>
  );
}

/**
 * Guest landing: sticky brand bar + a warm hero whose single yellow CTA sends
 * a pabili list, a 3-step "How it works?" overview (expandable to the full
 * timeline), the two ways to order, and rider/merchant paths. No store list.
 */
export default function LandingScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  // Earn paths need an account (the gate screens read the profile); guests go
  // to sign-in, where the role picker sets rider/merchant mode.
  const { session } = useAuth();
  const goEarn = (target: 'Rider' | 'Merchant') => {
    if (!session) {
      navigation.navigate('AuthHome');
      return;
    }
    if (target === 'Rider') navigation.navigate('Rider');
    else navigation.navigate('Merchant');
  };

  return (
    <Screen scroll={false} edges={['top']} padding={0} gap={0}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        {/* Sticky top bar, stays put while the page scrolls. */}
        <View style={styles.topBar}>
          <View style={styles.brandBlock}>
            <BrandLogo width={34} />
            <Text style={styles.brand}>IslaPabili</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Login or register"
            onPress={() => navigation.navigate('AuthHome')}
            style={({ pressed }) => [styles.loginPill, pressed && styles.pressed]}
          >
            <AppIcon name="user" size={16} color={colors.primaryDeep} />
            <Text style={styles.loginLabel}>Login/Register</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* Hero: the pitch and the one yellow conversion action. */}
          <Card variant="tinted" style={styles.hero}>
            <Text style={styles.heroTitle}>Pabili na, hatid pa sa pinto mo.</Text>
            <Text style={styles.heroBody}>
              Mamili sa mga tindahan sa buong Marinduque, o i-type mo lang ang listahan at rider na ang bahala.
            </Text>

            <Button
              title="Send a Pabili List"
              variant="primary"
              icon={<AppIcon name="pabili" size={20} color={colors.onPrimary} />}
              onPress={() => navigation.navigate('PabiliCreate')}
            />
            <Button
              title="Tingnan ang mga tindahan"
              variant="outline"
              size="md"
              onPress={() => navigation.navigate('Market')}
            />

            <View style={styles.trustRow}>
              <TrustChip icon="rating" label="4.8 rating" />
              <View style={styles.trustDot} />
              <TrustChip icon="rider" label="5 bayan" />
              <View style={styles.trustDot} />
              <TrustChip icon="wallet" label="Cash o e-pay" />
            </View>
          </Card>

          {/* 3-step overview, expandable to the full timeline. */}
          <HowItWorks
            variant="landing"
            onCreate={() => navigation.navigate('PabiliCreate')}
            onBrowse={() => navigation.navigate('Market')}
          />

          {/* Two ways to order. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dalawang paraan mag-order</Text>
            <View style={styles.waysRow}>
              {WAYS.map((way) => (
                <Pressable
                  key={way.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${way.title}. ${way.body}`}
                  onPress={() =>
                    way.route === 'Market'
                      ? navigation.navigate('Market')
                      : navigation.navigate('PabiliCreate')
                  }
                  style={({ pressed }) => [styles.wayCard, pressed && styles.pressed]}
                >
                  <View style={[styles.wayMedallion, { backgroundColor: way.medallionBg }]}>
                    <AppIcon name={way.icon} size={20} color={way.medallionFg} />
                  </View>
                  <Text style={styles.wayTitle}>{way.title}</Text>
                  <Text style={styles.wayBody}>{way.body}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Earn with IslaPabili. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gusto mong kumita?</Text>
            <Button
              title="Mag-rider ka"
              variant="soft"
              icon={<AppIcon name="rider" size={18} color={colors.primaryDeep} />}
              onPress={() => goEarn('Rider')}
            />
            <Button
              title="I-partner ang tindahan mo"
              variant="soft"
              icon={<AppIcon name="storefront" size={18} color={colors.primaryDeep} />}
              onPress={() => goEarn('Merchant')}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xxl, gap: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  brandBlock: { flex: 1, alignItems: 'flex-start', gap: 2 },
  brand: { ...typography.title, fontSize: 18, color: colors.primaryDeep },
  loginPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadows.card,
  },
  loginLabel: { ...typography.label, fontWeight: '700', color: colors.primaryDeep },

  body: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.xs,
    gap: spacing.sectionGap,
  },

  hero: { gap: spacing.md },
  heroTitle: { ...typography.display, fontSize: 26 },
  heroBody: { ...typography.body, color: colors.body },
  trustRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  trustChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { ...typography.micro, color: colors.muted },
  trustDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.faint },

  section: { gap: spacing.md },
  sectionTitle: { ...typography.heading, fontSize: 19 },
  waysRow: { flexDirection: 'row', gap: spacing.md },
  wayCard: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  wayMedallion: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wayTitle: { ...typography.subhead, fontWeight: '700' },
  wayBody: { ...typography.caption, color: colors.muted },

  pressed: { opacity: 0.7 },
});
