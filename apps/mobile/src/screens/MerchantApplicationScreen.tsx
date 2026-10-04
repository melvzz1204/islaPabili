import { useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { File as FileHandle } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { SUPPORTED_TOWNS, TOWN_LABELS, type Town } from '@isla/shared';
import { useAuth, type Database } from '@isla/supabase';
import {
  AppIcon,
  AuthHeader,
  Button,
  Card,
  OptionPicker,
  Screen,
  SheetModal,
  colors,
  radius,
  spacing,
  typography,
} from '@isla/ui';
import { TextField } from '../ui/TextField';
import { SingleTownPicker } from '../ui/TownPicker';

type Category = Database['public']['Enums']['merchant_category'];

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'fast_food', label: 'Fast Food' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'drugstore', label: 'Drugstore / Pharmacy' },
  { value: 'local', label: 'Local Shop' },
];

type PhotoPick = { uri: string; name: string; mime: string; bytes: number };

type PickedAsset = {
  uri: string;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
  mimeType?: string | null;
};

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const PHOTO_MAX_EDGE = 1600;
const PHOTO_QUALITY = 0.75;

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const readBytes = (uri: string): number | null => {
  if (Platform.OS === 'web') return null;
  try {
    return new FileHandle(uri).size ?? null;
  } catch {
    return null;
  }
};

const toUploadBody = async (pick: PhotoPick): Promise<FormData | ArrayBuffer> => {
  if (Platform.OS === 'web') {
    const form = new FormData();
    const blob = await (await fetch(pick.uri)).blob();
    form.append('file', blob, pick.name);
    return form;
  }
  const buffer = await new FileHandle(pick.uri).arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error('That photo file looks empty. Please pick the photo again.');
  }
  return buffer;
};

const resizePhoto = async (asset: PickedAsset): Promise<{ uri: string; bytes: number }> => {
  const context = ImageManipulator.manipulate(asset.uri);
  const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
  if (longEdge > PHOTO_MAX_EDGE) {
    const scale = PHOTO_MAX_EDGE / longEdge;
    context.resize({
      width: Math.round((asset.width ?? longEdge) * scale),
      height: Math.round((asset.height ?? longEdge) * scale),
    });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, bytes: readBytes(saved.uri) ?? asset.fileSize ?? 0 };
};

type Props = {
  onSubmitted: () => void;
};

export default function MerchantApplicationScreen({ onSubmitted }: Props) {
  const { client, profile } = useAuth();
  const [ownerName, setOwnerName] = useState(profile?.full_name ?? '');
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState<Category>('local');
  const [town, setTown] = useState<Town | null>(null);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<PhotoPick | null>(null);
  const [permit, setPermit] = useState<PhotoPick | null>(null);
  const [preparing, setPreparing] = useState<'logo' | 'permit' | null>(null);
  const [picking, setPicking] = useState<{ key: 'logo' | 'permit'; label: string } | null>(null);
  const [formError, setFormError] = useState<{ title: string; message?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fail = (title: string, message?: string) => setFormError({ title, message });

  const canSubmit =
    ownerName.trim().length >= 2 &&
    storeName.trim().length >= 2 &&
    town != null &&
    address.trim().length >= 4 &&
    logo != null;

  const attachPhoto = async (key: 'logo' | 'permit', asset: PickedAsset) => {
    const label = key === 'logo' ? 'Store logo' : 'Business permit';
    setPreparing(key);
    try {
      let uri = asset.uri;
      let bytes = asset.fileSize ?? 0;
      try {
        const resized = await resizePhoto(asset);
        uri = resized.uri;
        bytes = resized.bytes;
      } catch (err) {
        console.warn('[merchant-apply] resize failed, using original', err);
      }
      if (bytes > MAX_PHOTO_BYTES) {
        fail(`${label} is too large`, `That photo is ${formatBytes(bytes)}, over the 3 MB limit.`);
        return;
      }
      const pick = { uri, name: `${key}.jpg`, mime: 'image/jpeg', bytes };
      setFormError(null);
      if (key === 'logo') setLogo(pick);
      else setPermit(pick);
    } catch {
      fail('Could not attach photo', 'Please try again.');
    } finally {
      setPreparing(null);
    }
  };

  const capturePhoto = async (key: 'logo' | 'permit', source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          fail('Camera blocked', 'Allow camera access in settings to take photos.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync();
        if (!result.canceled && result.assets[0]) await attachPhoto(key, result.assets[0]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      if (!result.canceled && result.assets[0]) await attachPhoto(key, result.assets[0]);
    } catch {
      fail('Could not attach photo', 'Please try again.');
    }
  };

  const uploadPhoto = async (pick: PhotoPick, uid: string, bucket: string, key: string) => {
    const path = `${bucket}/${uid}/${key}.jpg`;
    const { error } = await client.storage.from(bucket).upload(path, await toUploadBody(pick), {
      upsert: true,
      contentType: pick.mime,
    });
    if (error) throw new Error(error.message);
    return path;
  };

  const handleSubmit = async () => {
    if (ownerName.trim().length < 2) {
      fail('Owner name required', 'Enter the full name of the store owner.');
      return;
    }
    if (storeName.trim().length < 2) {
      fail('Store name required', 'Enter your store name.');
      return;
    }
    if (!town) {
      fail('Town required', 'Pick the town where your store operates.');
      return;
    }
    if (address.trim().length < 4) {
      fail('Full address required', 'Enter the complete store address customers will see.');
      return;
    }
    if (!logo) {
      fail('Store logo required', 'Upload an image for your store logo.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: userData } = await client.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Not signed in');
      const logo_url = await uploadPhoto(logo, uid, 'store-logos', 'logo');
      const business_permit_url = permit ? await uploadPhoto(permit, uid, 'onboarding-docs', 'business_permit') : null;
      const { error } = await client.from('merchant_applications').insert({
        applicant_id: uid,
        owner_name: ownerName.trim(),
        store_name: storeName.trim(),
        category,
        town,
        address: address.trim(),
        phone: phone.trim() || null,
        description: description.trim() || null,
        logo_url,
        business_permit_url,
        status: 'pending',
      });
      if (error) throw new Error(error.message);
      onSubmitted();
    } catch (err) {
      fail('Could not submit', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderPhotoRow = (
    key: 'logo' | 'permit',
    label: string,
    hint: string,
    pick: PhotoPick | null,
    required: boolean,
  ) => (
    <View style={styles.photoRow}>
      <View style={styles.photoText}>
        <Text style={styles.photoLabel}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        <Text style={styles.photoHint}>{hint}</Text>
        {pick ? (
          <Text style={styles.photoName}>
            Attached · {formatBytes(pick.bytes)}
          </Text>
        ) : null}
      </View>
      {pick ? (
        <Image source={{ uri: pick.uri }} style={styles.thumb} />
      ) : (
        <View style={styles.thumbEmpty}>
          <AppIcon name="storefront" size={22} color={colors.faint} />
        </View>
      )}
      <View style={styles.photoActions}>
        <Button
          title={preparing === key ? 'Working…' : pick ? 'Retake' : 'Upload'}
          variant="secondary"
          onPress={() => setPicking({ key, label })}
          disabled={preparing != null}
        />
      </View>
    </View>
  );

  return (
    <Screen>
      <AuthHeader
        icon="storefront"
        title="Register your store"
        subtitle="Tell us about your tindahan. A superadmin reviews every application before it goes live."
      />
      <View style={styles.form}>
        <TextField
          label="Full name ng may-ari *"
          placeholder="Juan Dela Cruz"
          value={ownerName}
          onChangeText={setOwnerName}
          autoCapitalize="words"
        />
        <TextField
          label="Store name *"
          placeholder="Aling Nena's Sari-Sari – Boac"
          value={storeName}
          onChangeText={setStoreName}
        />
        <View>
          <Text style={styles.fieldLabel}>Store category</Text>
          <OptionPicker variant="list" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        </View>
        <View>
          <Text style={styles.fieldLabel}>Town *</Text>
          <SingleTownPicker variant="field" value={town} onChange={setTown} placeholder="Select store town" />
        </View>
        <TextField
          label="Full address *"
          placeholder="Street, barangay, landmark"
          value={address}
          onChangeText={setAddress}
          multiline
        />
        <TextField
          label="Contact number"
          placeholder="09XX XXX XXXX"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextField
          label="Store description"
          placeholder="Ano ang tinda ninyo? Bakit kayo special?"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />
        <Card variant="tinted">
          {renderPhotoRow('logo', 'Store logo *', 'Square image, shown to customers', logo, true)}
          {renderPhotoRow('permit', 'Business permit', 'Photo of your permit (optional)', permit, false)}
        </Card>
        {formError ? (
          <Card variant="tinted">
            <Text style={styles.errorTitle}>{formError.title}</Text>
            {formError.message ? <Text style={styles.errorBody}>{formError.message}</Text> : null}
          </Card>
        ) : null}
        <Button
          title={submitting ? 'Submitting…' : 'Submit application'}
          onPress={handleSubmit}
          disabled={submitting || !canSubmit}
        />
        <Text style={styles.note}>
          Towns served: {SUPPORTED_TOWNS.map((t) => TOWN_LABELS[t]).join(' · ')}
        </Text>
      </View>

      <SheetModal
        visible={picking != null}
        title={picking?.label ?? 'Upload photo'}
        subtitle="Photos are resized to a 3 MB limit."
        onClose={() => setPicking(null)}
      >
        <View style={styles.sheetActions}>
          <Button
            title="Take photo"
            onPress={() => {
              const key = picking?.key;
              setPicking(null);
              if (key) void capturePhoto(key, 'camera');
            }}
          />
          <Button
            title="Choose from library"
            variant="secondary"
            onPress={() => {
              const key = picking?.key;
              setPicking(null);
              if (key) void capturePhoto(key, 'library');
            }}
          />
        </View>
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xxl },
  fieldLabel: { ...typography.label, color: colors.body, marginBottom: 6 },
  photoRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  photoText: { gap: 2 },
  photoLabel: { ...typography.subhead, fontWeight: '700' },
  required: { color: colors.danger },
  photoHint: { ...typography.caption, color: colors.muted },
  photoName: { ...typography.caption, color: colors.primaryDeep, fontWeight: '700' },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  thumbEmpty: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { alignSelf: 'flex-start' },
  errorTitle: { ...typography.subhead, fontWeight: '700', color: colors.danger },
  errorBody: { ...typography.body, color: colors.body, marginTop: 2 },
  sheetActions: { gap: spacing.sm },
  note: { ...typography.caption, color: colors.faint, textAlign: 'center' },
});
