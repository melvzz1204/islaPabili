import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  isAllTowns,
  isNoTowns,
  resolveOptedTowns,
  TOWN_LABELS,
  townSelectionLabel,
  type Town,
} from '@isla/shared';
import { signOut as supabaseSignOut, useAuth } from '@isla/supabase';
import {
  AppIcon,
  Button,
  Card,
  colors,
  ListRow,
  radius,
  Screen,
  ScreenHeader,
  SectionHeader,
  SheetModal,
  spacing,
  typography,
  useToast,
  type AppIconName,
} from '@isla/ui';
import { TownPicker } from '../ui/TownPicker';
import type { TabScreen } from '../navigation/types';

type Props = TabScreen<'Profile'>;

const ACCOUNT_LINKS: { label: string; detail: string; icon: AppIconName }[] = [
  { label: 'Saved addresses', detail: 'Manage delivery addresses', icon: 'pin' },
  { label: 'Payment methods', detail: 'Cash on delivery and more', icon: 'wallet' },
  { label: 'Terms & privacy', detail: 'How we handle your data', icon: 'shield' },
  { label: 'Help & support', detail: 'FAQs and contact details', icon: 'support' },
];

export default function ProfileScreen({ navigation }: Props) {
  const { client, session, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [riderExitOpen, setRiderExitOpen] = useState(false);
  const [editingTowns, setEditingTowns] = useState(false);

  const currentTowns = useMemo(() => resolveOptedTowns(profile), [profile]);
  const [draftTowns, setDraftTowns] = useState<Town[]>(currentTowns);
  const [savingTowns, setSavingTowns] = useState(false);

  const email = session?.user.email ?? '';
  const displayName =
    profile?.full_name || profile?.username || email.split('@')[0] || 'IslaPabili shopper';
  const phone = profile?.phone ?? '';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'I';

  const openTownEditor = () => {
    setDraftTowns(currentTowns);
    setEditingTowns(true);
  };

  const handleSaveTowns = async () => {
    if (isNoTowns(draftTowns)) {
      showToast({ message: 'Pick at least one municipality.', type: 'error' });
      return;
    }
    setSavingTowns(true);
    const { error } = await client
      .from('profiles')
      .update({
        town_preferences: draftTowns,
        // Keep the delivery town pointing at a town the customer still opted into.
        home_town:
          draftTowns.includes(currentTowns[0] as Town) || isNoTowns(currentTowns)
            ? (draftTowns[0] ?? null)
            : (profile?.home_town ?? draftTowns[0] ?? null),
      })
      .eq('id', profile!.id);
    await refreshProfile();
    setSavingTowns(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    setEditingTowns(false);
    showToast({ message: 'Municipality preferences updated.', type: 'success' });
  };

  const handleSignOut = () => {
    setConfirmSignOut(false);
    // Redirect first — sign-out finishes in the background, so a slow
    // network can never trap the user on this screen.
    navigation.navigate('Shop');
    void supabaseSignOut(client).catch(() => {
      showToast({ message: 'Could not sign out. Please try again.', type: 'error' });
    });
  };

  const handleBecomeRider = () => {
    setRiderExitOpen(false);
    navigation.navigate('Shop');
    void supabaseSignOut(client).catch(() => {
      showToast({ message: 'Could not sign out. Please try again.', type: 'error' });
    });
  };

  return (
    <Screen>
      <ScreenHeader title="Profile" />

      <Card style={styles.identityCard} variant="flat">
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {email ? (
              <Text style={styles.detail} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
            {phone ? (
              <Text style={styles.detail} numberOfLines={1}>
                {phone}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={() => showToast({ message: 'Profile editing is coming soon.', type: 'info' })}
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          >
            <AppIcon name="edit" size={15} color={colors.body} />
          </Pressable>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Account" />
        <Card variant="flat" style={styles.listCard} padded={false}>
          <ListRow
            icon="pin"
            title="Municipalities"
            subtitle={
              isNoTowns(currentTowns)
                ? 'None selected yet'
                : isAllTowns(currentTowns)
                  ? 'All municipalities'
                  : `${currentTowns.map((t) => TOWN_LABELS[t]).join(', ')}`
            }
            onPress={openTownEditor}
            divider
          />
          {ACCOUNT_LINKS.map((link, index) => (
            <ListRow
              key={link.label}
              icon={link.icon}
              title={link.label}
              subtitle={link.detail}
              divider={index < ACCOUNT_LINKS.length - 1}
              onPress={() => showToast({ message: `${link.label} is coming soon.`, type: 'info' })}
            />
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Earn with us" />
        <Card variant="flat" style={styles.listCard} padded={false}>
          <ListRow
            icon="rider"
            title="Become a rider"
            subtitle="Log out, then log in as a rider"
            onPress={() => setRiderExitOpen(true)}
          />
        </Card>
      </View>

      <Button title="Sign out" variant="secondary" onPress={() => setConfirmSignOut(true)} />

      <SheetModal
        visible={editingTowns}
        title="Your municipalities"
        subtitle={townSelectionLabel(draftTowns)}
        onClose={() => setEditingTowns(false)}
        footer={
          <View style={styles.confirmRow}>
            <Button title="Cancel" variant="secondary" onPress={() => setEditingTowns(false)} />
            <Button title="Save" loading={savingTowns} onPress={() => void handleSaveTowns()} />
          </View>
        }
      >
        <Text style={styles.confirmCopy}>
          We only show you stores from the municipalities you pick. Tap &ldquo;All&rdquo; to browse the
          whole island.
        </Text>
        <TownPicker value={draftTowns} onChange={setDraftTowns} />
      </SheetModal>

      <SheetModal
        visible={confirmSignOut}
        title="Sign out?"
        subtitle="You can sign back in any time."
        onClose={() => setConfirmSignOut(false)}
        footer={
          <View style={styles.confirmRow}>
            <Button title="Cancel" variant="secondary" onPress={() => setConfirmSignOut(false)} />
            <Button title="Sign out" variant="danger" onPress={handleSignOut} />
          </View>
        }
      >
        <Text style={styles.confirmCopy}>
          Your cart stays on this device so you can pick up where you left off.
        </Text>
      </SheetModal>

      <SheetModal
        visible={riderExitOpen}
        title="Switch to rider mode?"
        subtitle="Rider mode is separate — log out first, then log in as a rider."
        onClose={() => setRiderExitOpen(false)}
        footer={
          <View style={styles.confirmRow}>
            <Button title="Cancel" variant="secondary" onPress={() => setRiderExitOpen(false)} />
            <Button title="Log out" variant="danger" onPress={handleBecomeRider} />
          </View>
        }
      >
        <Text style={styles.confirmCopy}>
          Your customer cart stays on this device.
        </Text>
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityCard: { padding: spacing.lg },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: colors.onPrimary },
  identityText: { flex: 1, gap: 1 },
  name: { ...typography.subhead, fontWeight: '700' },
  detail: { ...typography.caption },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { gap: spacing.sm },
  listCard: { padding: 0, overflow: 'hidden' },

  confirmRow: { flexDirection: 'row', gap: spacing.sm },
  confirmCopy: { ...typography.body, color: colors.muted },
  pressed: { opacity: 0.6 },
});
