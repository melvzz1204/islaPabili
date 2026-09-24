import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { TOWN_LABELS, type Town } from '@isla/shared';
import { useAuth } from '@isla/supabase';
import type { Database } from '@isla/supabase';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { TownPicker } from '../ui/TownPicker';
import { colors, radius, spacing, typography } from '../ui/theme';

type RiderApplicationRow = Database['public']['Tables']['rider_applications']['Row'];

const DOC_FIELDS: { key: DocKey; label: string; hint: string }[] = [
  { key: 'driver_license', label: "Driver's License", hint: 'Front side photo' },
  { key: 'vehicle_registration', label: 'Vehicle Registration (OR/CR)', hint: 'Official Receipt / Certificate of Registration' },
  { key: 'vehicle_photo', label: 'Vehicle Photo', hint: 'Clear side view of your motorcycle' },
  { key: 'helmet_photo', label: 'Helmet with Safety Marking', hint: 'High-visibility / standard helmet' },
  { key: 'bg_clearance', label: 'Barangay / NBI Clearance', hint: 'Background clearance document' },
  { key: 'selfie', label: 'Rider Profile Photo', hint: 'Clear face photo for your profile' },
];

type DocKey = 'driver_license' | 'vehicle_registration' | 'vehicle_photo' | 'helmet_photo' | 'bg_clearance' | 'selfie';

type DocUrlField = 'driver_license_url' | 'vehicle_registration_url' | 'vehicle_photo_url' | 'helmet_photo_url' | 'bg_clearance_url' | 'rider_photo_url';

const DOC_URL_FIELD: Record<DocKey, DocUrlField> = {
  driver_license: 'driver_license_url',
  vehicle_registration: 'vehicle_registration_url',
  vehicle_photo: 'vehicle_photo_url',
  helmet_photo: 'helmet_photo_url',
  bg_clearance: 'bg_clearance_url',
  selfie: 'rider_photo_url',
};

type DocPick = { uri: string; name: string; mime: string | null };

type Props = {
  onSubmitted: () => void;
};

export default function RiderApplicationScreen({ onSubmitted }: Props) {
  const { client, profile, refreshProfile } = useAuth();
  const [town, setTown] = useState<Town | null>(null);
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [drivingYears, setDrivingYears] = useState('');
  const [docs, setDocs] = useState<Partial<Record<DocKey, DocPick>>>({});
  const [submitting, setSubmitting] = useState(false);

  const pickDoc = async (key: DocKey) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const ext = (asset.fileName?.split('.').pop() ?? asset.mimeType?.split('/')[1] ?? 'jpg').toLowerCase();
    setDocs((prev) => ({
      ...prev,
      [key]: { uri: asset.uri, name: `${key}.${ext}`, mime: asset.mimeType ?? null },
    }));
  };

  const uploadDoc = async (pick: DocPick, uid: string, key: DocKey) => {
    const path = `onboarding-docs/${uid}/${key}`;
    const form = new FormData();
    form.append('file', { uri: pick.uri, name: pick.name, type: pick.mime ?? 'image/jpeg' } as unknown as Blob);
    const { error } = await client.storage.from('onboarding-docs').upload(path, form as unknown as ArrayBuffer, {
      upsert: true,
      contentType: pick.mime ?? 'image/jpeg',
    });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!town) {
      Alert.alert('Town required', 'Pick the town where you will operate.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Add a contact number so IslaPabili can reach you.');
      return;
    }
    const years = Number(drivingYears);
    if (!Number.isFinite(years) || years < 0) {
      Alert.alert('Invalid experience', 'Enter your driving experience in years.');
      return;
    }
    const missing = DOC_FIELDS.filter((f) => !docs[f.key]);
    if (missing.length > 0) {
      Alert.alert('Documents missing', `Please attach: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await client.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Not signed in');

      const urls: Partial<Record<DocUrlField, string>> = {};
      for (const key of Object.keys(docs) as DocKey[]) {
        const pick = docs[key];
        if (pick) urls[DOC_URL_FIELD[key]] = await uploadDoc(pick, uid, key);
      }

      const { error: profileError } = await client
        .from('profiles')
        .update({ home_town: town, phone: phone.trim(), full_name: profile?.full_name ?? '' })
        .eq('id', uid);
      if (profileError) throw profileError;

      const { error: appError } = await client.from('rider_applications').insert({
        rider_id: uid,
        ...urls,
        driving_experience_years: years,
        status: 'pending',
      });
      if (appError) throw appError;

      await refreshProfile();
      onSubmitted();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong while saving.';
      Alert.alert('Could not submit', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Text style={typography.title}>Rider application</Text>
      <Text style={styles.hint}>
        Tell us about yourself and upload your compliance documents. Application is reviewed by
        an IslaPabili administrator before you can go on duty.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Operating town (required)</Text>
        <TownPicker value={town} onChange={setTown} />
      </View>

      <TextField
        label="Mobile number (required)"
        placeholder="09XX XXX XXXX"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextField
        label="Driving experience (years)"
        placeholder="e.g. 3"
        keyboardType="number-pad"
        value={drivingYears}
        onChangeText={setDrivingYears}
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Documents (all required)</Text>
        {DOC_FIELDS.map((field) => {
          const picked = docs[field.key];
          return (
            <View key={field.key} style={styles.docRow}>
              <View style={styles.docInfo}>
                <Text style={styles.docLabel}>{field.label}</Text>
                <Text style={styles.docHint}>{field.hint}</Text>
                <Text style={[styles.docStatus, picked ? styles.docStatusOk : styles.docStatusMissing]}>
                  {picked ? 'Attached' : 'Not attached'}
                </Text>
              </View>
              {picked ? <Image source={{ uri: picked.uri }} style={styles.docThumb} /> : null}
              <Button
                title={picked ? 'Replace' : 'Upload'}
                variant={picked ? 'secondary' : 'primary'}
                onPress={() => void pickDoc(field.key)}
              />
            </View>
          );
        })}
      </View>

      <Button title="Submit application" onPress={() => void handleSubmit()} loading={submitting} />
      <Text style={styles.finePrint}>
        Supported towns: {'\n'}
        {Object.values(TOWN_LABELS).join(', ')}.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.muted },
  section: { gap: spacing.sm },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  docRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  docInfo: { gap: spacing.xs },
  docLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  docHint: { fontSize: 12, color: colors.muted },
  docStatus: { fontSize: 13, fontWeight: '600' },
  docStatusOk: { color: colors.success },
  docStatusMissing: { color: colors.warn },
  docThumb: { width: 64, height: 64, borderRadius: radius.sm },
  finePrint: { ...typography.caption, textAlign: 'center', color: colors.muted },
});

export type { RiderApplicationRow };