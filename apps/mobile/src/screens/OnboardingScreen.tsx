import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  isNoTowns,
  resolveOptedTowns,
  SUPPORTED_TOWNS,
  TOWN_LABELS,
  type Town,
} from '@isla/shared';
import { useAuth } from '@isla/supabase';
import { Button, Screen, TextField, spacing, typography } from '@isla/ui';
import { TownPicker } from '../ui/TownPicker';

/** 409 on profiles PATCH = phone already linked to another account. Say so plainly. */
function friendlySaveError(error: { code?: string; message: string }): string {
  if (error.code === '23505' || error.message.includes('profiles_phone_key')) {
    return 'That mobile number is already linked to another account. Use a different number, or log in with the account that uses it.';
  }
  return error.message;
}

export default function OnboardingScreen() {
  const { client, profile, refreshProfile } = useAuth();
  // resolveOptedTowns falls back to home_town for rows written before
  // town_preferences existed.
  const [towns, setTowns] = useState<Town[]>(() => resolveOptedTowns(profile));
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [saving, setSaving] = useState(false);

  // The first chosen municipality doubles as the delivery home town.
  const homeTown = towns[0] ?? null;

  const handleSave = async () => {
    if (isNoTowns(towns)) {
      Alert.alert(
        'Pick a municipality',
        "Choose at least one municipality so we know which stores to show you, or tap 'All'.",
      );
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Add a contact number for the runner.');
      return;
    }
    if (!profile) {
      Alert.alert('Profile not loaded', 'Pull to retry — your profile is still loading.');
      await refreshProfile();
      return;
    }
    setSaving(true);
    const { error } = await client
      .from('profiles')
      .update({
        home_town: homeTown,
        town_preferences: towns,
        phone: phone.trim(),
        address: address.trim(),
      })
      .eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', friendlySaveError(error));
    }
  };

  return (
    <Screen>
      <Text style={typography.display}>Where are you?</Text>
      <Text style={styles.hint}>
        Pick every municipality you want to order from. Tap &ldquo;All&rdquo; to see the whole island.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Municipalities (required)</Text>
        <TownPicker value={towns} onChange={setTowns} />
      </View>

      <Text style={styles.hint}>
        {homeTown
          ? `Deliveries default to ${TOWN_LABELS[homeTown]} — you can change it at checkout.`
          : 'Your first pick becomes your default delivery town.'}
      </Text>

      <TextField
        label="Mobile number (required)"
        placeholder="09XX XXX XXXX"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextField
        label="Address (optional)"
        placeholder="Street / barangay / landmark"
        value={address}
        onChangeText={setAddress}
      />
      <Button title="Save and continue" onPress={() => void handleSave()} loading={saving} />
      <Text style={styles.finePrint}>
        Supported municipalities: {SUPPORTED_TOWNS.map((t) => TOWN_LABELS[t]).join(', ')}.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption },
  section: { gap: spacing.sm },
  sectionLabel: { ...typography.subhead, fontSize: 14, fontWeight: '600' },
  finePrint: { ...typography.caption, textAlign: 'center' },
});
