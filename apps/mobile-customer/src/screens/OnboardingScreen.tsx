import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SUPPORTED_TOWNS, TOWN_LABELS, type Town } from '@isla/shared';
import { useAuth } from '@isla/supabase';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { TownPicker } from '../ui/TownPicker';
import { colors, spacing, typography } from '../ui/theme';

export default function OnboardingScreen() {
  const { client, profile, refreshProfile } = useAuth();
  const [homeTown, setHomeTown] = useState<Town | null>(profile?.home_town ?? null);
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!homeTown) {
      Alert.alert('Town required', "Pick the town where you'll receive deliveries.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Add a contact number for the runner.');
      return;
    }
    setSaving(true);
    const { error } = await client
      .from('profiles')
      .update({ home_town: homeTown, phone: phone.trim(), address: address.trim() })
      .eq('id', profile!.id);
    await refreshProfile();
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error.message);
    }
  };

  return (
    <Screen>
      <Text style={typography.title}>Where are you?</Text>
      <Text style={styles.hint}>
        This is your default town and contact number. You can change these anytime from your profile.
      </Text>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Home town (required)</Text>
        <TownPicker value={homeTown} onChange={setHomeTown} />
      </View>
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
        Supported towns: {SUPPORTED_TOWNS.map((t) => TOWN_LABELS[t]).join(', ')}.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.muted },
  section: { gap: spacing.sm },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  finePrint: { ...typography.caption, textAlign: 'center', color: colors.muted },
});