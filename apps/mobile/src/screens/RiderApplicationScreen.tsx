import { useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { File as FileHandle } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { isAllTowns, isNoTowns, resolveOptedTowns, TOWN_LABELS, type Town } from '@isla/shared';
import { useAuth } from '@isla/supabase';
import type { Database } from '@isla/supabase';
import {
  AppIcon,
  AuthHeader,
  Badge,
  Button,
  Card,
  Screen,
  SheetModal,
  brandCopy,
  colors,
  radius,
  spacing,
  typography,
} from '@isla/ui';
import { TextField } from '../ui/TextField';
import { TownPicker } from '../ui/TownPicker';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';

type RiderApplicationRow = Database['public']['Tables']['rider_applications']['Row'];

const DOC_FIELDS: { key: DocKey; label: string; hint: string }[] = [
  { key: 'driver_license_front', label: "Driver's License (front)", hint: 'Front side, details clearly readable' },
  { key: 'driver_license_back', label: "Driver's License (back)", hint: 'Back side, restrictions clearly readable' },
  { key: 'selfie', label: 'Rider Profile Photo', hint: 'Clear face photo for your profile' },
];

type DocKey = 'driver_license_front' | 'driver_license_back' | 'selfie';

type DocUrlField = 'driver_license_front_url' | 'driver_license_back_url' | 'rider_photo_url';

const DOC_URL_FIELD: Record<DocKey, DocUrlField> = {
  driver_license_front: 'driver_license_front_url',
  driver_license_back: 'driver_license_back_url',
  selfie: 'rider_photo_url',
};

type DocPick = { uri: string; name: string; mime: string; bytes: number };

/**
 * Per-document upload cap, mirrored by file_size_limit on the onboarding-docs
 * bucket in 0017_compliance_doc_limits.sql.
 */
const MAX_DOC_BYTES = 3 * 1024 * 1024;
const MAX_DOC_LABEL = '3 MB';

// A compliance photo is a document, not a print scan. Capping the long edge is
// what actually keeps a 108 MP phone camera from producing a 12 MB upload; the
// quality setting then keeps small text on a licence legible.
const DOC_MAX_EDGE = 1600;
const DOC_QUALITY = 0.7;

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** The subset of expo-image-picker's asset we actually consume. */
type PickedAsset = {
  uri: string;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
  mimeType?: string | null;
};

type PreparedDoc = { uri: string; bytes: number; mime: string; resized: boolean };

/**
 * Byte size of a local file. expo-file-system is a console-warning stub on web,
 * so this returns null there and the caller falls back to the picker's own
 * fileSize rather than silently treating every document as 0 bytes.
 */
const readBytes = (uri: string): number | null => {
  // expo-file-system is a warning-only stub on web, so do not poke it there.
  if (Platform.OS === 'web') return null;
  try {
    return new FileHandle(uri).size ?? null;
  } catch {
    return null;
  }
};

/**
 * Build the multipart body for a Supabase Storage upload. React Native's
 * FormData accepts a `{uri,name,type}` descriptor, but a browser's FormData
 * needs a real Blob — appending the descriptor there would silently upload the
 * string "[object Object]".
 */
const toUploadBody = async (pick: DocPick): Promise<FormData> => {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(pick.uri)).blob();
    form.append('file', blob, pick.name);
  } else {
    form.append('file', {
      uri: pick.uri,
      name: pick.name,
      type: pick.mime,
    } as unknown as Blob);
  }
  return form;
};

/** Turn anything thrown into a sentence a rider can act on. */
const describeError = (err: unknown): string => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  // The web manipulator rejects with a bare <canvas>, which stringifies to
  // "[object HTMLCanvasElement]" and tells the rider nothing.
  return 'The photo could not be processed. Please try a different image.';
};

type Props = {
  onSubmitted: () => void;
};

export default function RiderApplicationScreen({ onSubmitted }: Props) {
  const { client, profile, refreshProfile } = useAuth();
  // Operating area is a set: a rider may cover several municipalities, or all
  // of them. Falls back to home_town for riders who have not applied yet.
  const [operatingTowns, setOperatingTowns] = useState<Town[]>(() => resolveOptedTowns(profile));
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [drivingYears, setDrivingYears] = useState('');
  const [docs, setDocs] = useState<Partial<Record<DocKey, DocPick>>>({});
  const [preparing, setPreparing] = useState<DocKey | null>(null);
  const [pickingDoc, setPickingDoc] = useState<{ key: DocKey; label: string } | null>(null);
  // Alert.alert is a no-op on react-native-web, so this form surfaces problems
  // inline instead. Anything routed through Alert fails silently in a browser.
  const [formError, setFormError] = useState<{ title: string; message?: string } | null>(null);
  const fail = (title: string, message?: string) => setFormError({ title, message });
  const [submitting, setSubmitting] = useState(false);

  const hasArea = !isNoTowns(operatingTowns);
  const years = Number(drivingYears);
  const yearsValid = drivingYears.trim() !== '' && Number.isFinite(years) && years >= 0;
  const attachedDocs = DOC_FIELDS.filter((f) => docs[f.key]);
  const missingDocs = DOC_FIELDS.filter((f) => !docs[f.key]);
  const stepsDone = (hasArea ? 1 : 0) + (phone.trim() ? 1 : 0) + (yearsValid ? 1 : 0) + attachedDocs.length;
  const stepsTotal = 3 + DOC_FIELDS.length;
  const canSubmit = stepsDone === stepsTotal;

  const progress = useMemo(() => stepsDone / stepsTotal, [stepsDone, stepsTotal]);

  const captureDoc = async (key: DocKey, source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          fail('Camera blocked', 'Allow camera access in settings to take document photos.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync();
        if (!result.canceled && result.assets[0]) {
          await attachDoc(key, result.assets[0]);
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      if (!result.canceled && result.assets[0]) {
        await attachDoc(key, result.assets[0]);
      }
    } catch {
      fail('Could not attach photo', 'Please try again.');
    }
  };

  /**
   * Downscale and re-encode a picked document, then measure the result against
   * the per-document cap. Resizing first means an oversized camera photo is
   * shrunk rather than rejected, and the size we show is the size we upload.
   *
   * If the manipulator cannot run we still attach the original pick rather than
   * dead-ending the form, so the rider can finish and the bucket limit in 0017
   * remains the backstop.
   */
  const resizeDoc = async (asset: PickedAsset): Promise<PreparedDoc | null> => {
    const context = ImageManipulator.manipulate(asset.uri);
    const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
    if (longEdge > DOC_MAX_EDGE) {
      // Scale both axes by the same factor. Passing only one axis to resize()
      // would let it choose the other, and passing DOC_MAX_EDGE for both would
      // squash the document to a square.
      const scale = DOC_MAX_EDGE / longEdge;
      context.resize({
        width: Math.round((asset.width ?? longEdge) * scale),
        height: Math.round((asset.height ?? longEdge) * scale),
      });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: DOC_QUALITY, format: SaveFormat.JPEG });
    return {
      uri: saved.uri,
      bytes: readBytes(saved.uri) ?? asset.fileSize ?? 0,
      mime: 'image/jpeg',
      resized: true,
    };
  };

  /**
   * Attach a picked document, preferring a resized copy. Falls back to the
   * original pick if the optimiser fails so the application is never blocked
   * by it; the bucket limit from 0017 is the backstop either way.
   */
  const attachDoc = async (key: DocKey, asset: PickedAsset) => {
    const label = DOC_FIELDS.find((f) => f.key === key)?.label ?? 'Photo';
    setPreparing(key);
    try {
      let prepared: PreparedDoc;
      try {
        const result = await resizeDoc(asset);
        if (!result) throw new Error('Resize produced no file');
        prepared = result;
      } catch (err) {
        // Never block the application on the optimiser. Fall back to the pick.
        console.warn('[rider-docs] resize failed, using original', err);
        prepared = {
          uri: asset.uri,
          bytes: asset.fileSize ?? 0,
          mime: asset.mimeType ?? 'image/jpeg',
          resized: false,
        };
      }

      if (prepared.bytes > MAX_DOC_BYTES) {
        fail(
          `${label} is too large`,
          `That photo is ${formatBytes(prepared.bytes)}${
            prepared.resized ? ' even after resizing' : ''
          }, over the ${MAX_DOC_LABEL} limit. Please choose a different photo.`,
        );
        return;
      }

      setFormError(null);
      setDocs((prev) => ({
        ...prev,
        [key]: { uri: prepared.uri, name: `${key}.jpg`, mime: prepared.mime, bytes: prepared.bytes },
      }));
    } catch (err) {
      fail('Could not attach photo', describeError(err));
    } finally {
      setPreparing(null);
    }
  };

  // An Alert action sheet cannot be used here: Alert.alert is a no-op on react-
  // native-web, so the tap would silently do nothing. A SheetModal works
  // everywhere and gives the size limit somewhere to live.
  const pickDoc = (key: DocKey, label: string) => {
    setPickingDoc({ key, label });
  };

  const startCapture = async (key: DocKey, source: 'camera' | 'library') => {
    setPickingDoc(null);
    await captureDoc(key, source);
  };

  const removeDoc = (key: DocKey) => {
    setDocs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const uploadDoc = async (pick: DocPick, uid: string, key: DocKey) => {
    // The RLS policies in 0004_storage.sql key off the leading 'onboarding-docs'
    // folder segment, so that prefix is required even though the bucket already
    // carries the same name. Dropping it fails the upload on a policy error.
    const path = `onboarding-docs/${uid}/${key}.jpg`;
    const { error } = await client.storage.from('onboarding-docs').upload(path, await toUploadBody(pick), {
      upsert: true,
      contentType: pick.mime,
    });
    if (error) throw new Error(error.message);
    return path;
  };

  const handleSubmit = async () => {
    if (isNoTowns(operatingTowns)) {
      fail(
        'Operating area required',
        "Pick at least one municipality where you can deliver, or tap 'All' to cover the island.",
      );
      return;
    }
    if (!phone.trim()) {
      fail('Phone required', 'Add a contact number so IslaPabili can reach you.');
      return;
    }
    if (!yearsValid) {
      fail('Invalid experience', 'Enter your driving experience in years.');
      return;
    }
    if (missingDocs.length > 0) {
      fail('Documents missing', `Please attach: ${missingDocs.map((m) => m.label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    const uploaded: string[] = [];
    try {
      const { data: userData } = await client.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Not signed in');

      const urls: Partial<Record<DocUrlField, string>> = {};
      for (const key of Object.keys(docs) as DocKey[]) {
        const pick = docs[key];
        if (!pick) continue;
        const label = DOC_FIELDS.find((f) => f.key === key)?.label ?? key;
        try {
          const path = await uploadDoc(pick, uid, key);
          uploaded.push(path);
          urls[DOC_URL_FIELD[key]] = path;
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'unknown error';
          throw new Error(`Could not upload ${label} — ${reason}`);
        }
      }

      // Operating area is its own column. home_town means "where the rider
      // lives", so only fill it when the rider has not set one yet — otherwise
      // applying as a rider would silently move a customer's delivery town.
      const primaryTown = operatingTowns[0] ?? null;
      const { error: profileError } = await client
        .from('profiles')
        .update({
          ...(profile?.home_town ? {} : { home_town: primaryTown }),
          phone: phone.trim(),
        })
        .eq('id', uid);
      if (profileError) throw profileError;

      const { error: appError } = await client.from('rider_applications').insert({
        rider_id: uid,
        ...urls,
        operating_towns: operatingTowns,
        driving_experience_years: years,
        status: 'pending',
      });
      if (appError) throw appError;

      await refreshProfile();
      onSubmitted();
    } catch (err) {
      // Never leave half a submission in storage for an admin to trip over.
      if (uploaded.length) {
        await client.storage.from('onboarding-docs').remove(uploaded);
      }
      const message = err instanceof Error ? err.message : 'Something went wrong while saving.';
      fail('Could not submit', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT}>
      <AuthHeader
        icon="rider"
        accent
        title="Rider application"
        subtitle={brandCopy.riderOnboarding}
      />

      <Card style={styles.progressCard}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {stepsDone} of {stepsTotal} complete
          </Text>
          <Badge
            label={canSubmit ? 'Ready to submit' : 'In progress'}
            status={canSubmit ? 'delivered' : 'pending'}
          />
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { flex: progress }]} />
          <View style={{ flex: Math.max(1 - progress, 0) }} />
        </View>
        <Text style={styles.progressHint}>
          An IslaPabili administrator reviews every application before you can go on duty.
        </Text>
      </Card>

      <View style={styles.section}>
        <StepTitle
          index="01"
          title="Operating area"
          subtitle="Where will you accept pabili? Tap All to cover the whole island."
        />
        <TownPicker value={operatingTowns} onChange={setOperatingTowns} />
        <Text style={styles.hint}>
          {isAllTowns(operatingTowns)
            ? `You will be dispatched anywhere on the island. Your first pick (${TOWN_LABELS[operatingTowns[0]]}) is recorded as your home town.`
            : 'You can request more municipalities later.'}
        </Text>
      </View>

      <View style={styles.section}>
        <StepTitle index="02" title="Contact & experience" subtitle="How do we reach you?" />
        <TextField
          label="Mobile number (required)"
          placeholder="09XX XXX XXXX"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={phone}
          onChangeText={setPhone}
          leftAccessory={<AppIcon name="phone" size={20} weight="bold" color={colors.onPrimary} />}
        />
        <TextField
          label="Driving experience (years)"
          placeholder="e.g. 3"
          keyboardType="number-pad"
          value={drivingYears}
          onChangeText={setDrivingYears}
          leftAccessory={<AppIcon name="rider" size={20} weight="bold" color={colors.onPrimary} />}
        />
      </View>

      <View style={styles.section}>
        <StepTitle
          index="03"
          title="Compliance documents"
          subtitle={`${attachedDocs.length} of ${DOC_FIELDS.length} attached`}
        />
        {DOC_FIELDS.map((field, i) => {
          const picked = docs[field.key];
          const busy = preparing === field.key;
          return (
            <Card key={field.key}>
              <View style={styles.docHead}>
                <View style={[styles.stepCircle, picked && styles.stepCircleDone]}>
                  <Text style={[styles.stepNumber, picked && styles.stepNumberDone]}>
                    {picked ? '✓' : i + 1}
                  </Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docLabel}>{field.label}</Text>
                  <Text style={styles.docHint}>
                    {busy ? 'Resizing photo…' : picked ? `${field.hint} · ${formatBytes(picked.bytes)}` : field.hint}
                  </Text>
                </View>
                <Badge
                  label={picked ? 'Attached' : busy ? 'Working' : 'Missing'}
                  status={picked ? 'delivered' : 'neutral'}
                />
              </View>
              {picked ? (
                <Image source={{ uri: picked.uri }} style={styles.docPreview} />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Upload ${field.label}`}
                  disabled={busy}
                  onPress={() => pickDoc(field.key, field.label)}
                  style={styles.dropzone}
                >
                  <AppIcon name="add" size={28} />
                  <Text style={styles.dropzoneLabel}>Tap to take or upload a photo</Text>
                </Pressable>
              )}
              <View style={styles.docActions}>
                <View style={styles.docActionsFlex}>
                  <Button
                    title={picked ? 'Replace' : 'Upload'}
                    variant={picked ? 'secondary' : 'primary'}
                    loading={busy}
                    onPress={() => pickDoc(field.key, field.label)}
                  />
                </View>
                {picked ? (
                  <Pressable onPress={() => removeDoc(field.key)} accessibilityRole="button">
                    <Text style={styles.removeLabel}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          );
        })}
        <Text style={styles.hint}>
          Photos only, up to {MAX_DOC_LABEL} each. We resize and compress on your device before
          uploading, so even a large camera photo is fine as long as it is readable.
        </Text>
      </View>

      {formError ? (
        <View style={styles.errorBanner}>
          <AppIcon name="warning" size={20} color={colors.danger} />
          <View style={styles.errorText}>
            <Text style={styles.errorTitle}>{formError.title}</Text>
            {formError.message ? <Text style={styles.errorMessage}>{formError.message}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
            hitSlop={10}
            onPress={() => setFormError(null)}
          >
            <AppIcon name="close" size={14} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}

      <Card style={styles.summaryCard}>
        <Badge label={canSubmit ? 'Ready' : 'Checklist'} status={canSubmit ? 'delivered' : 'pending'} />
        <Text style={typography.subhead}>
          {canSubmit
            ? 'Everything is attached. Submit for review.'
            : `Still needed: ${[
                !hasArea && 'operating area',
                !phone.trim() && 'mobile number',
                !yearsValid && 'driving experience',
                ...missingDocs.map((d) => d.label),
              ]
                .filter(Boolean)
                .join(', ')}.`}
        </Text>
        <Button
          title="Submit application"
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={!canSubmit}
        />
      </Card>

      <Text style={styles.finePrint}>
        Supported municipalities: {Object.values(TOWN_LABELS).join(', ')}.
      </Text>

      <SheetModal
        visible={pickingDoc !== null}
        title={pickingDoc?.label ?? 'Add document'}
        subtitle="Add a clear, readable photo."
        onClose={() => setPickingDoc(null)}
        footer={
          <Button title="Cancel" variant="secondary" onPress={() => setPickingDoc(null)} />
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Take a photo of your ${pickingDoc?.label ?? 'document'}`}
          onPress={() => void startCapture(pickingDoc!.key, 'camera')}
          style={({ pressed }) => [styles.sourceRow, pressed && styles.sourceRowPressed]}
        >
          <AppIcon name="camera" size={20} color={colors.primary} />
          <View style={styles.sourceText}>
            <Text style={styles.sourceTitle}>Take photo</Text>
            <Text style={styles.sourceHint}>Use your camera now</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose a photo of your ${pickingDoc?.label ?? 'document'}`}
          onPress={() => void startCapture(pickingDoc!.key, 'library')}
          style={({ pressed }) => [styles.sourceRow, pressed && styles.sourceRowPressed]}
        >
          <AppIcon name="image" size={20} color={colors.primary} />
          <View style={styles.sourceText}>
            <Text style={styles.sourceTitle}>Choose from library</Text>
            <Text style={styles.sourceHint}>Pick an existing photo</Text>
          </View>
        </Pressable>
        <Text style={styles.hint}>
          Up to {MAX_DOC_LABEL}. We resize and compress on your device, so a large camera photo is
          fine as long as the text stays readable.
        </Text>
      </SheetModal>
    </Screen>
  );
}

function StepTitle({ index, title, subtitle }: { index: string; title: string; subtitle: string }) {
  return (
    <View style={styles.stepTitle}>
      <View style={styles.stepIndex}>
        <Text style={styles.stepIndexText}>{index}</Text>
      </View>
      <View style={styles.stepTitleText}>
        <Text style={styles.sectionLabel}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.muted },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sourceRowPressed: { opacity: 0.7 },
  sourceText: { flex: 1, gap: 2 },
  sourceTitle: { ...typography.subhead, fontWeight: '700' },
  sourceHint: { ...typography.caption, color: colors.muted },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { flex: 1, gap: 2 },
  errorTitle: { ...typography.subhead, fontWeight: '700', color: colors.danger },
  errorMessage: { ...typography.caption, color: colors.body },
  progressCard: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { ...typography.subhead, fontWeight: '700' },
  track: { flexDirection: 'row', height: 8, borderRadius: radius.full, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { backgroundColor: colors.accent, borderRadius: radius.full },
  progressHint: { ...typography.caption },
  section: { gap: spacing.sm },
  stepTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepIndex: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndexText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  stepTitleText: { flex: 1, gap: 2 },
  sectionLabel: { ...typography.subhead, fontWeight: '700', fontSize: 16 },
  sectionSubtitle: { ...typography.caption },
  docHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepNumber: { fontWeight: '700', fontSize: 14, color: colors.muted },
  stepNumberDone: { color: colors.onPrimary },
  docInfo: { flex: 1, gap: 2 },
  docLabel: { ...typography.subhead, fontWeight: '600' },
  docHint: { ...typography.caption },
  docPreview: { width: '100%', height: 160, borderRadius: radius.md, backgroundColor: colors.bg },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.faint,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  dropzoneLabel: { ...typography.caption, fontWeight: '600' },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  docActionsFlex: { flex: 1 },
  removeLabel: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  summaryCard: { borderColor: colors.primary, borderWidth: 1.5, alignItems: 'flex-start' },
  finePrint: { ...typography.caption, textAlign: 'center' },
});

export type { RiderApplicationRow };
