import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { File as FileHandle } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { TOWN_CENTERS, fareBreakdownLabel, fareConfigFromDefaults, type FareConfig, type Town } from '@isla/shared';
import { useAuth } from '@isla/supabase';
import { callRpc } from '../lib/rpc';
import { invokePush } from '../lib/push';
import { flatFallbackQuote, loadFareConfig, quoteTrip } from '../marketplace/fare';
import {
  AppIcon,
  Badge,
  Button,
  Card,
  OrDivider,
  Screen,
  SheetModal,
  colors,
  radius,
  shadows,
  spacing,
  typography,
  useToast,
  type AppIconName,
} from '@isla/ui';
import { TextField } from '../ui/TextField';
import { AddressAutocomplete } from '../maps/AddressAutocomplete';
import { SingleTownPicker } from '../ui/TownPicker';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { goToTab, type RootNavProp, type RootStackScreen } from '../navigation/types';
import { peso } from '../marketplace/data';
import { PABILI_COMBOS, type PabiliCombo } from '../marketplace/pabiliCombos';

type Props = RootStackScreen<'PabiliCreate'>;

type ListRow = { name: string; qty: string };

const EMPTY_ROW: ListRow = { name: '', qty: '1' };
const CUSTOM_STORE = '__custom__';

/** Snapshot of a handwritten paper pabili list, uploaded at submit time. */
type ListPhoto = { uri: string; name: string; mime: string; bytes: number };
type PickedAsset = {
  uri: string;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
  mimeType?: string | null;
};

const MAX_LIST_PHOTOS = 3;
const MAX_LIST_PHOTO_BYTES = 5 * 1024 * 1024;

/** Quick-pick stores. Merchant catalog arrives later, for now these + typing. */
const PRESET_STORES = ['Jollibee', 'Public Market'];

/** Combo art: icon + tint per combo so quick picks read as mini menu cards. */
const COMBO_ART: Record<string, { icon: AppIconName; bg: string; fg: string }> = {
  jollibee: { icon: 'storefront', bg: '#FDEBD7', fg: colors.primaryDeep },
  condiments: { icon: 'categoryGrocery', bg: '#E4F5E9', fg: '#14532D' },
  laundry: { icon: 'package', bg: '#E6EEFD', fg: '#1E3A8A' },
  beverage: { icon: 'categoryCoffee', bg: '#FDF0D9', fg: '#78350F' },
  sinigang: { icon: 'categoryFood', bg: '#FDEBD7', fg: colors.primaryDeep },
  adobo: { icon: 'categoryFood', bg: '#FDE5E5', fg: '#991B1B' },
  tinola: { icon: 'categoryFood', bg: '#E4F5E9', fg: '#14532D' },
  pulutan: { icon: 'categoryFood', bg: '#FDE5E5', fg: '#991B1B' },
};

const comboArt = (id: string) =>
  COMBO_ART[id] ?? { icon: 'package' as AppIconName, bg: colors.surfaceSunken, fg: colors.body };

export default function PabiliCreateScreen({ route }: Props) {
  const navigation = useNavigation<RootNavProp>();
  const { client, profile } = useAuth();
  const { showToast } = useToast();
  // Deep-link entry (e.g. the Jollibee tile on Home) preloads a combo,
  // or a custom item list (e.g. picked from the Jollibee menu).
  const routeParams = route.params;
  const preset = PABILI_COMBOS.find((c) => c.id === routeParams?.comboId);
  const presetItems = routeParams?.items?.length
    ? routeParams.items
    : preset
      ? preset.items
      : null;
  const presetStore = routeParams?.store ?? preset?.store;
  const [rows, setRows] = useState<ListRow[]>(() =>
    presetItems ? presetItems.map((i) => ({ ...i })) : [{ ...EMPTY_ROW }],
  );
  // Add-items modal (item rows + paper-list photos live here, not inline).
  const [itemsOpen, setItemsOpen] = useState(false);
  const [photos, setPhotos] = useState<ListPhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const named = rows.filter((r) => r.name.trim());
  const itemCount = named.reduce((n, r) => n + Math.max(1, Number.parseInt(r.qty, 10) || 1), 0);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [town, setTown] = useState<Town | null>(profile?.home_town ?? null);
  const [address, setAddress] = useState(profile?.address ?? '');
  const [storePick, setStorePick] = useState<string | null>(() =>
    presetStore && PRESET_STORES.includes(presetStore) ? presetStore : null,
  );
  const [customStore, setCustomStore] = useState(() =>
    presetStore && !PRESET_STORES.includes(presetStore) ? presetStore : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [gpsPrompt, setGpsPrompt] = useState(false);
  const [finding, setFinding] = useState<{
    orderId: string;
    orderNumber: string;
    offered: number;
    town: string;
    fee: number;
    distanceKm: number;
    feeDetail: string;
    phase: 'searching' | 'stopped' | 'found';
    rider?: {
      name: string;
      phone: string;
      avatarUrl: string | null;
      years: number | null;
      licensed: boolean;
    } | null;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [fareConfig, setFareConfig] = useState<FareConfig>(() => fareConfigFromDefaults());
  const pulse = useRef(new Animated.Value(0)).current;

  // Live pricing rules from the admin console (base + per-km + tiers).
  useEffect(() => {
    void loadFareConfig(client).then(setFareConfig);
  }, [client]);

  // Radar pulse while actively searching. Self-restarting JS-driver loop:
  // keeps going indefinitely (Animated.loop can stall on web) and freezes
  // the moment the panel pauses.
  useEffect(() => {
    if (!finding || finding.offered === 0 || finding.phase !== 'searching') return;
    let alive = true;
    pulse.setValue(0);
    const tick = () => {
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && alive) {
          pulse.setValue(0);
          tick();
        }
      });
    };
    tick();
    return () => {
      alive = false;
    };
  }, [finding, pulse]);

  // Finding only ends two ways: the customer stops it, or a rider accepts.
  // Watch our own order, on accept, pull the rider card instead of leaving.
  // (showRiderCard is declared below; the handler only runs after mount.)
  const showRiderCardRef = useRef<(orderId: string, riderId: string) => void>(() => {});
  useEffect(() => {
    if (!finding || finding.offered === 0 || finding.phase === 'found') return;
    const channel = client
      .channel(`pabili-finding-${finding.orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${finding.orderId}` },
        (payload) => {
          const row = payload.new as { status?: string; rider_id?: string };
          if (row?.status === 'rider_assigned' && row.rider_id) {
            void showRiderCardRef.current(finding.orderId, row.rider_id);
          }
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, finding?.orderId, finding?.phase]);

  /** Load the assigned rider's public card (profile + application + photo). */
  const showRiderCard = useCallback(
    async (orderId: string, riderId: string) => {
    const [{ data: profile }, { data: application }] = await Promise.all([
      client.from('profiles').select('full_name, phone, avatar_url').eq('id', riderId).maybeSingle(),
      client
        .from('rider_applications')
        .select('rider_photo_url, driving_experience_years, status')
        .eq('rider_id', riderId)
        .maybeSingle(),
    ]);
    let avatarUrl: string | null = profile?.avatar_url ?? null;
    const photoPath = (application?.rider_photo_url ?? '').replace(/^onboarding-docs\//, '');
    if (!avatarUrl && photoPath) {
      const { data: signed } = await client.storage
        .from('onboarding-docs')
        .createSignedUrl(photoPath, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    }
    // The fee is revealed (from GPS kilometer distance) now that a rider
    // exists — never before. The row already carries the submit-time quote,
    // which used the same GPS pin when one was granted; recompute it here so
    // the displayed total always derives from stored coordinates. No row
    // write: customers lose update rights once the order leaves dispatch.
    let finalFee: number | null = null;
    let finalKm: number | null = null;
    let finalDetail: string | null = null;
    try {
      const { data: orderData } = await client
        .from('orders')
        .select('town, dropoff_lat, dropoff_lng')
        .eq('id', orderId)
        .maybeSingle();
      const o = orderData as {
        town: Town;
        dropoff_lat: number | null;
        dropoff_lng: number | null;
      } | null;
      if (o?.dropoff_lat != null && o?.dropoff_lng != null) {
        const cfg = await loadFareConfig(client);
        const q = quoteTrip({
          pickup: TOWN_CENTERS[o.town],
          dropoff: { lat: o.dropoff_lat, lng: o.dropoff_lng },
          itemCount,
          estimated: false,
          config: cfg,
        });
        finalFee = q.fee;
        finalKm = q.distanceKm;
        finalDetail = fareBreakdownLabel(q, peso);
      }
    } catch {
      // Offline hiccup: keep the submit-time quote already on screen.
    }
    setFinding((prev) =>
      prev && prev.orderId === orderId
        ? {
            ...prev,
            phase: 'found',
            ...(finalFee != null && finalKm != null && finalDetail != null
              ? { fee: finalFee, distanceKm: finalKm, feeDetail: finalDetail }
              : null),
            rider: {
              name: profile?.full_name?.trim() || 'Your rider',
              phone: profile?.phone?.trim() || '',
              avatarUrl,
              years: application?.driving_experience_years ?? null,
              licensed: application?.status === 'approved',
            },
          }
        : prev,
    );
  }, [client, itemCount]);

  // Keep the realtime handler above pointed at the latest loader.
  useEffect(() => {
    showRiderCardRef.current = showRiderCard;
  }, [showRiderCard]);

  /** Live on-duty headcount covering this town, while the radar is up. */
  const [dutyCount, setDutyCount] = useState<number | null>(null);
  useEffect(() => {
    if (!finding || finding.phase !== 'searching') return;
    let alive = true;
    const loadDuty = async () => {
      const { count } = await client
        .from('rider_status')
        .select('rider_id', { count: 'exact', head: true })
        .eq('on_duty', true)
        .contains('operating_towns', [finding.town]);
      if (alive) setDutyCount(count ?? 0);
    };
    void loadDuty();
    const channel = client
      .channel(`rider-duty-${finding.town}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_status' }, () => {
        void loadDuty();
      })
      .subscribe();
    return () => {
      alive = false;
      void client.removeChannel(channel);
    };
  }, [client, finding]);

  /** Stop finding = pause the search (request stays open). Cancel kills it. */
  const pauseFinding = () => {
    setFinding((prev) => (prev ? { ...prev, phase: 'stopped' } : prev));
  };

  /** Retry = fresh offer round, then back to the live radar. */
  const retryFinding = async () => {
    if (!finding) return;
    setWorking(true);
    const { data: offered, error } = await callRpc<number>(client, 'request_pabili_riders', {
      p_order_id: finding.orderId,
    });
    setWorking(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    showToast({
      message:
        (offered ?? 0) > 0
          ? `Looking again, ${offered} rider${offered === 1 ? '' : 's'} notified.`
          : 'Still no riders on duty. Try again in a bit.',
      type: (offered ?? 0) > 0 ? 'success' : 'error',
    });
    setFinding({ ...finding, offered: offered ?? 0, phase: 'searching' });
    // Wake on-duty riders whose apps are killed/backgrounded.
    if ((offered ?? 0) > 0) void invokePush(client, finding.orderId, 'pabili');
  };

  const cancelFinding = async () => {
    if (!finding) return;
    setSubmitting(true);
    const { error } = await client
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', finding.orderId);
    setSubmitting(false);
    if (error) {
      showToast({ message: error.message, type: 'error' });
      return;
    }
    showToast({ message: 'Pabili request cancelled.', type: 'success' });
    goToTab(navigation, 'Orders');
  };

  // No fee is shown before a rider accepts: the working quote is computed at
  // submit (for the rider offer + receipt) and only revealed afterwards.

  const setRow = (index: number, patch: Partial<ListRow>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const removeRow = (index: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  /** Stepper: qty stays numeric (1-99), typed text falls back to 1. */
  const bumpQty = (index: number, delta: number) =>
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const next = Math.min(99, Math.max(1, (Number.parseInt(r.qty, 10) || 1) + delta));
        return { ...r, qty: String(next) };
      }),
    );

  /** Snap or attach a paper-list photo (handwritten list, shelf tag, etc.). */
  const pickListPhoto = async (source: 'camera' | 'library') => {
    if (photos.length >= MAX_LIST_PHOTOS) {
      showToast({ message: `Up to ${MAX_LIST_PHOTOS} list photos only.`, type: 'error' });
      return;
    }
    setPhotoBusy(true);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          showToast({ message: 'Allow camera access to snap your paper list.', type: 'error' });
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (!result.canceled && result.assets[0]) await attachListPhoto(result.assets[0]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      if (!result.canceled && result.assets[0]) await attachListPhoto(result.assets[0]);
    } catch {
      showToast({ message: 'Could not attach that photo. Please try again.', type: 'error' });
    } finally {
      setPhotoBusy(false);
    }
  };

  const attachListPhoto = async (asset: PickedAsset) => {
    let bytes = asset.fileSize ?? 0;
    if (Platform.OS !== 'web') {
      try {
        bytes = new FileHandle(asset.uri).size ?? bytes;
      } catch {
        // Fall back to the picker's own fileSize; the bucket limit backstops us.
      }
    }
    if (bytes > MAX_LIST_PHOTO_BYTES) {
      showToast({ message: 'That photo is over 5 MB. Please pick a smaller one.', type: 'error' });
      return;
    }
    setPhotos((prev) =>
      prev.length >= MAX_LIST_PHOTOS
        ? prev
        : [
            ...prev,
            {
              uri: asset.uri,
              name: `list-${Date.now()}-${prev.length}.jpg`,
              mime: asset.mimeType ?? 'image/jpeg',
              bytes,
            },
          ],
    );
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  /**
   * Upload body for Supabase Storage. Browsers need a real Blob in FormData;
   * on native, storage-js wants raw bytes (Blob/FormData uploads don't work).
   */
  const toUploadBody = async (photo: ListPhoto): Promise<FormData | ArrayBuffer> => {
    if (Platform.OS === 'web') {
      const form = new FormData();
      const blob = await (await fetch(photo.uri)).blob();
      form.append('file', blob, photo.name);
      return form;
    }
    const buffer = await new FileHandle(photo.uri).arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error('A list photo file looks empty. Please re-attach it.');
    }
    return buffer;
  };

  const uploadListPhotos = async (uid: string): Promise<string[]> => {
    const paths: string[] = [];
    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i]!;
      const path = `pabili-lists/${uid}/${Date.now()}-${i}.jpg`;
      const { error } = await client.storage
        .from('pabili-lists')
        .upload(path, await toUploadBody(photo), { upsert: true, contentType: photo.mime });
      if (error) throw new Error(error.message);
      paths.push(path);
    }
    return paths;
  };

  /** Last tapped combo id, for the checkmark flash on its card. */
  const [addedCombo, setAddedCombo] = useState<string | null>(null);
  const storeName =
    storePick === CUSTOM_STORE ? customStore.trim() : (storePick ?? '').trim();

  /** Drop a preset combo into the list (replaces the untouched blank row). */
  const addCombo = (combo: PabiliCombo) => {
    setRows((prev) => {
      const base = prev.length === 1 && !prev[0]!.name.trim() ? [] : prev;
      return [...base, ...combo.items.map((i) => ({ ...i }))];
    });
    if (combo.store) {
      if (PRESET_STORES.includes(combo.store)) {
        setStorePick(combo.store);
        setCustomStore('');
      } else {
        setStorePick(CUSTOM_STORE);
        setCustomStore(combo.store);
      }
    }
    showToast({ message: `${combo.label} added, edit qty as needed.`, type: 'success' });
    setAddedCombo(combo.id);
    setTimeout(() => {
      setAddedCombo((prev) => (prev === combo.id ? null : prev));
    }, 1600);
  };

  /** Validated, now ask for GPS before sending (other apps do the same). */
  const handleSubmit = () => {
    if (named.length === 0 && photos.length === 0) {
      showToast({ message: 'Add at least one item or a photo of your list.', type: 'error' });
      return;
    }
    if (!phone.trim()) {
      showToast({ message: 'Add a contact number for the rider.', type: 'error' });
      return;
    }
    if (!town || !address.trim()) {
      showToast({ message: 'Add your town and delivery address.', type: 'error' });
      return;
    }
    setGpsPrompt(true);
  };

  const doSubmit = async (useGps: boolean) => {
    setGpsPrompt(false);
    const { data: userData } = await client.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      showToast({ message: 'Session expired. Please log in again.', type: 'error' });
      return;
    }
    // Re-checked here (already validated before the GPS prompt) for types.
    if (!town || !address.trim()) {
      showToast({ message: 'Add your town and delivery address.', type: 'error' });
      return;
    }
    // Best effort: without GPS the rider falls back to the written address.
    let gps: { lat: number; lng: number } | null = null;
    if (useGps) {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } else {
          showToast({ message: 'Location blocked, riders will use your written address.', type: 'error' });
        }
      } catch {
        showToast({ message: 'Could not read your location, using your written address.', type: 'error' });
      }
    }
    setSubmitting(true);
    try {
      // Paper-list photos go up first so the order row can reference them.
      const listPhotoUrls = await uploadListPhotos(uid);
      // Final quote: town-center shop area → customer GPS when pinned,
      // otherwise the flat estimate shown on the form. Snapshot every input
      // so the receipt is auditable.
      const finalQuote = gps
        ? quoteTrip({ pickup: TOWN_CENTERS[town], dropoff: gps, itemCount, config: fareConfig, estimated: false })
        : flatFallbackQuote(itemCount, fareConfig);
      const finalFee = finalQuote.fee;
      const { data: order, error: orderError } = await client
        .from('orders')
        .insert({
          customer_id: uid,
          merchant_id: null,
          town,
          dropoff_address: address.trim(),
          dropoff_lat: gps?.lat ?? null,
          dropoff_lng: gps?.lng ?? null,
          dropoff_notes: `${name.trim()} · ${phone.trim()}`,
          fulfillment_mode: 'rider_pabili',
          status: 'pending_dispatch',
          is_custom_list: true,
          list_photo_urls: listPhotoUrls,
          store_name: storeName || null,
          payment_method: 'cod',
          est_items_total: 0,
          distance_km: Math.round(finalQuote.distanceKm * 100) / 100,
          base_fare: finalQuote.baseFare,
          per_km_rate: Number(fareConfig.per_km_rate),
          distance_fee: Math.round(finalQuote.distanceFee * 100) / 100,
          volume_surcharge: finalQuote.volumeSurcharge,
          total_delivery_fee: finalFee,
          grand_total: finalFee,
        })
        .select('id, order_number')
        .single();
      if (orderError || !order) throw orderError ?? new Error('Pabili request was not created.');
      const { error: itemsError } = await client.from('order_items').insert(
        named.map((r) => ({
          order_id: order.id,
          name: r.name.trim(),
          quantity: Math.max(1, Number.parseInt(r.qty, 10) || 1),
        })),
      );
      if (itemsError) throw itemsError;

      // Offer the list to whoever is on duty right now.
      const { data: offered, error: rpcError } = await callRpc<number>(client, 'request_pabili_riders', {
        p_order_id: order.id,
      });
      if (rpcError) throw rpcError;
      setSubmitting(false);
      // Wake on-duty riders whose apps are killed/backgrounded.
      if ((offered ?? 0) > 0) void invokePush(client, order.id, 'pabili');
      // Hand off to the full-screen finding moment. It stays until the
      // customer stops it or a rider accepts (realtime handoff above).
      setFinding({
        orderId: order.id,
        orderNumber: order.order_number,
        offered: offered ?? 0,
        town: town!,
        fee: finalFee,
        distanceKm: finalQuote.distanceKm,
        feeDetail: fareBreakdownLabel(finalQuote, peso),
        phase: 'searching',
      });
      return;
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Could not send your pabili list.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Screen
      footer={
        <View style={styles.footerStack}>
          <View style={[styles.stickyCta, shadows.sticky]}>
            <View style={styles.stickyTotals}>
              <Text style={styles.stickyCount}>
                {named.length} item{named.length === 1 ? '' : 's'} · {itemCount} pc
              </Text>
              <Text style={styles.stickyFeeNote}>₱45 base · fee after rider accepts</Text>
            </View>
            <Button
              title="Find a rider"
              variant="accent"
              onPress={handleSubmit}
              loading={submitting}
              fullWidth={false}
              style={styles.stickyBtn}
            />
          </View>
          <BottomNav />
        </View>
      }
      footerHeight={92 + BOTTOM_NAV_HEIGHT}
    >
      {/* Hero: no fee estimate until a rider accepts. */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroMedallion}>
            <AppIcon name="pabili" size={30} color={colors.primaryDeep} />
          </View>
        </View>
        <Text style={styles.heroTitle}>Pabili list</Text>
        <Text style={styles.heroSub}>Sabihin mo lang ang bibilhin, rider na ang bahala.</Text>
      </View>

      <Text style={styles.sectionLabel}>Simulan sa combo</Text>
      <Card style={styles.comboCard} padded={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.comboRow}>
          {PABILI_COMBOS.map((combo) => {
            const art = comboArt(combo.id);
            const added = addedCombo === combo.id;
            return (
              <Pressable
                key={combo.id}
                accessibilityRole="button"
                accessibilityLabel={`Add ${combo.label} combo, ${combo.items.length} items`}
                onPress={() => addCombo(combo)}
                style={({ pressed }) => [styles.comboTile, pressed && styles.pressed]}
              >
                <View style={[styles.comboArt, { backgroundColor: art.bg }]}>
                  <AppIcon name={art.icon} size={26} color={art.fg} />
                  {added ? (
                    <View style={styles.comboCheck}>
                      <AppIcon name="check" size={12} color={colors.onPrimary} />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.comboLabel} numberOfLines={1}>
                  {combo.label}
                </Text>
                <Text style={styles.comboSub} numberOfLines={1}>
                  {combo.items.length} items
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.comboHint}>Tap para idagdag ang buong set, tapos edit mo ang qty.</Text>
      </Card>

      <OrDivider label="or" />

      <Text style={styles.sectionLabel}>Pabili list ({named.length})</Text>
      <Card>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Items</Text>
          <Badge
            label={
              named.length > 0
                ? `${named.length} item${named.length === 1 ? '' : 's'}${photos.length > 0 ? ` · ${photos.length} photo${photos.length === 1 ? '' : 's'}` : ''}`
                : photos.length > 0
                  ? `${photos.length} photo${photos.length === 1 ? '' : 's'}`
                  : 'Empty'
            }
            status="pending"
          />
        </View>
        {named.length === 0 && photos.length === 0 ? (
          <Text style={styles.emptyList}>
            Walang laman — type your items or snap a photo of your paper list.
          </Text>
        ) : (
          <>
            {named.slice(0, 4).map((r, i) => (
              <Text key={i} style={styles.summaryLine} numberOfLines={1}>
                {Math.max(1, Number.parseInt(r.qty, 10) || 1)}× {r.name.trim()}
              </Text>
            ))}
            {named.length > 4 ? <Text style={styles.mutedLine}>+{named.length - 4} more</Text> : null}
            {photos.length > 0 ? (
              <View style={styles.summaryPhotos}>
                {photos.map((p, i) => (
                  <Image key={i} source={{ uri: p.uri }} style={styles.summaryThumb} />
                ))}
              </View>
            ) : null}
          </>
        )}
        <Button title="Add items List" variant="secondary" onPress={() => setItemsOpen(true)} />
      </Card>

      <Text style={styles.sectionLabel}>Saan bibilhin</Text>
      <Card>
        <View style={styles.storeGrid}>
          {[...PRESET_STORES, CUSTOM_STORE].map((store) => {
            const isCustom = store === CUSTOM_STORE;
            const label = isCustom ? 'Others' : store;
            const selected = storePick === store;
            return (
              <Pressable
                key={store}
                accessibilityRole="button"
                accessibilityLabel={isCustom ? 'Type another store' : `Buy at ${store}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  if (isCustom) {
                    setStorePick(CUSTOM_STORE);
                  } else {
                    setStorePick(store);
                    setCustomStore('');
                  }
                }}
                style={({ pressed }) => [
                  styles.storeTile,
                  selected && styles.storeTileSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.storeMono,
                    selected ? styles.storeMonoSelected : undefined,
                  ]}
                >
                  <Text style={[styles.storeMonoText, selected && styles.storeMonoTextSelected]}>
                    {label.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.storeLabel, selected && styles.storeLabelSelected]} numberOfLines={1}>
                  {label}
                </Text>
                {selected ? (
                  <View style={styles.storeCheck}>
                    <AppIcon name="check" size={11} color={colors.onPrimary} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {storePick === CUSTOM_STORE ? (
          <TextField
            label="Store name"
            placeholder="Type which store the rider should go to"
            value={customStore}
            onChangeText={setCustomStore}
          />
        ) : null}
      </Card>

      <Text style={styles.sectionLabel}>Ihahatid sa</Text>
      <Card>
        <Text style={styles.cardTitle}>Delivery details</Text>
        <TextField label="Recipient name" placeholder="Juan Dela Cruz" value={name} onChangeText={setName} />
        <TextField
          label="Mobile number"
          placeholder="09XX XXX XXXX"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Text style={styles.fieldLabel}>Town</Text>
        <SingleTownPicker variant="field" value={town} onChange={setTown} />
        <AddressAutocomplete value={address} onChangeText={setAddress} />
      </Card>

      <Card style={styles.summaryCard}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Delivery fee</Text>
          <Text style={styles.feeValue}>{peso(45)} base</Text>
        </View>
        <Text style={styles.finePrint}>
          No estimate until a rider accepts. The final total is computed from the real kilometer distance between
          the store and your GPS, and shown once your rider is found. You pay cash: items + delivery.
        </Text>
      </Card>
    </Screen>

    <SheetModal
      visible={itemsOpen}
      title="Add items List"
      subtitle="Type each item, or snap a photo of your paper list instead."
      onClose={() => setItemsOpen(false)}
      footer={<Button title={`Done · ${named.length} item${named.length === 1 ? '' : 's'}`} onPress={() => setItemsOpen(false)} />}
    >
      {rows.map((row, i) => {
        const qty = Number.parseInt(row.qty, 10) || 1;
        return (
          <View key={i} style={styles.itemRow}>
            <View style={[styles.itemNum, i > 0 && styles.itemNumNoLabel]}>
              <Text style={styles.itemNumText}>{i + 1}</Text>
            </View>
            <View style={styles.rowMain}>
              <TextField
                label={i === 0 ? 'Item' : undefined}
                placeholder="Anong bibilhin?"
                value={row.name}
                onChangeText={(v) => setRow(i, { name: v })}
              />
            </View>
            <View style={[styles.stepper, i > 0 && styles.stepperNoLabel]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Less of item ${i + 1}`}
                hitSlop={10}
                onPress={() => bumpQty(i, -1)}
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <Text style={styles.stepGlyph}>−</Text>
              </Pressable>
              <Text style={styles.stepQty}>{qty}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`More of item ${i + 1}`}
                hitSlop={10}
                onPress={() => bumpQty(i, 1)}
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <Text style={styles.stepGlyph}>+</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove item ${i + 1}`}
              hitSlop={10}
              onPress={() => removeRow(i)}
              style={[styles.remove, i > 0 && styles.removeNoLabel]}
            >
              <AppIcon name="close" size={14} color={colors.muted} />
            </Pressable>
          </View>
        );
      })}
      <Button title="Add another item" variant="ghost" onPress={() => setRows((p) => [...p, { ...EMPTY_ROW }])} />

      <OrDivider label="or" />

      <View style={styles.photoHead}>
        <Text style={styles.cardTitle}>Paper list photo ({photos.length}/{MAX_LIST_PHOTOS})</Text>
        <Text style={styles.photoHint}>Snap your handwritten list — the rider reads it directly.</Text>
      </View>
      {photos.length > 0 ? (
        <View style={styles.photoGrid}>
          {photos.map((p, i) => (
            <View key={i} style={styles.photoCell}>
              <Image source={{ uri: p.uri }} style={styles.photoThumb} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove list photo ${i + 1}`}
                hitSlop={10}
                onPress={() => removePhoto(i)}
                style={({ pressed }) => [styles.photoRemove, pressed && styles.pressed]}
              >
                <AppIcon name="close" size={12} color={colors.onPrimary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.photoActions}>
        <View style={styles.photoFlex}>
          <Button
            title="Snap paper list"
            variant="secondary"
            loading={photoBusy}
            onPress={() => void pickListPhoto('camera')}
          />
        </View>
        <View style={styles.photoFlex}>
          <Button
            title="From gallery"
            variant="secondary"
            disabled={photoBusy}
            onPress={() => void pickListPhoto('library')}
          />
        </View>
      </View>
    </SheetModal>

    <SheetModal
      visible={gpsPrompt}
      title="Turn on GPS?"
      subtitle="Precise location helps your rider find you fast."
      onClose={() => setGpsPrompt(false)}
      footer={
        <View style={styles.gpsActions}>
          <View style={styles.gpsFlex}>
            <Button title="Turn on GPS" loading={submitting} onPress={() => void doSubmit(true)} />
          </View>
          <Button title="Skip" variant="secondary" disabled={submitting} onPress={() => void doSubmit(false)} />
        </View>
      }
    >
      <Text style={styles.gpsBody}>
        We&apos;ll pin your exact drop-off next to your written address. You can still order with just the address,
        GPS only makes the handoff faster.
      </Text>
    </SheetModal>
    {finding ? (
      <View style={styles.findOverlay}>
        {finding.offered > 0 && finding.phase === 'searching' ? (
          <>
            <View style={styles.rings}>
              {[150, 200, 250].map((size) => (
                <Animated.View
                  key={size}
                  style={[
                    styles.ring,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                    },
                  ]}
                />
              ))}
              <View style={styles.findMedallion}>
                <AppIcon name="rider" size={44} color={colors.onPrimary} />
              </View>
            </View>
            <Text style={styles.findTitle}>Finding a rider…</Text>
            <Text style={styles.findSub}>
              {dutyCount == null
                ? `Notifying riders in ${finding.town}, first to accept wins.`
                : `${dutyCount} rider${dutyCount === 1 ? '' : 's'} on duty in ${finding.town} · ${finding.offered} notified, first to accept wins.`}
            </Text>
            <Text style={styles.findOrder}>{finding.orderNumber}</Text>
            <Text style={styles.findFeeDetail}>
              No fee yet — the total is computed from GPS distance once a rider accepts.
            </Text>
            <Button
              title="Stop finding"
              variant="danger"
              onPress={pauseFinding}
            />
          </>
        ) : finding.phase === 'found' && finding.rider ? (
          <>
            {finding.rider.avatarUrl ? (
              <Image source={{ uri: finding.rider.avatarUrl }} style={styles.riderAvatar} />
            ) : (
              <View style={styles.findMedallion}>
                <Text style={styles.riderInitials}>
                  {finding.rider.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <Text style={styles.findTitle}>{finding.rider.name}</Text>
            <View style={styles.riderBadges}>
              {finding.rider.licensed ? <Badge label="Licensed ✓" status="delivered" /> : null}
              {finding.rider.years != null ? (
                <Badge label={`${finding.rider.years}y exp`} status="pending" />
              ) : null}
            </View>
            {finding.rider.phone ? (
              <Text style={styles.findSub}>{finding.rider.phone}</Text>
            ) : null}
            <Text style={styles.findOrder}>{finding.orderNumber} · on the way to shop</Text>
            <Card style={styles.summaryCard}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Delivery fee</Text>
                <Text style={styles.feeValue}>{peso(finding.fee)}</Text>
              </View>
              <Text style={styles.finePrint}>
                {finding.distanceKm.toFixed(1)} km from your GPS · {finding.feeDetail}
              </Text>
              <Text style={styles.finePrint}>
                Pay the rider in cash: item costs + {peso(finding.fee)} delivery.
              </Text>
            </Card>
            <Button title="Track my order" onPress={() => goToTab(navigation, 'Orders')} />
          </>
        ) : finding.phase === 'stopped' ? (
          <>
            <View style={styles.findMedallion}>
              <AppIcon name="rider" size={44} color={colors.onPrimary} />
            </View>
            <Text style={styles.findTitle}>Finding paused</Text>
            <Text style={styles.findSub}>
              Your list stays open. Retry to ping whoever is on duty now, or cancel the request.
            </Text>
            <Text style={styles.findOrder}>{finding.orderNumber}</Text>
            <View style={styles.findActions}>
              <Button title="Retry finding rider" loading={working} onPress={() => void retryFinding()} />
              <Button
                title="Cancel request"
                variant="danger"
                loading={submitting}
                onPress={() => void cancelFinding()}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.findMedallion}>
              <AppIcon name="rider" size={44} color={colors.onPrimary} />
            </View>
            <Text style={styles.findTitle}>No riders on duty</Text>
            <Text style={styles.findSub}>
              Nobody in {finding.town} is online right now. Your list is saved, retry from Orders when ready.
            </Text>
            <Text style={styles.findOrder}>{finding.orderNumber}</Text>
            <View style={styles.findActions}>
              <Button title="Keep editing" variant="secondary" onPress={() => setFinding(null)} />
              <Button title="View my requests" onPress={() => goToTab(navigation, 'Orders')} />
            </View>
          </>
        )}
      </View>
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Hero
  hero: { gap: spacing.xs, paddingTop: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroMedallion: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { ...typography.display, fontSize: 30 },
  heroSub: { ...typography.body, color: colors.muted },

  // Rhythm: one small caps-ish label per section, cards do the talking.
  sectionLabel: { ...typography.micro, fontWeight: '700', letterSpacing: 0.8, color: colors.primaryDeep },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...typography.heading, fontSize: 16 },

  // Combo mini-cards
  comboCard: { paddingVertical: spacing.md },
  comboRow: { gap: spacing.sm, paddingHorizontal: spacing.base, paddingVertical: 2 },
  comboTile: { width: 104, alignItems: 'center', gap: 4 },
  comboArt: {
    width: 76,
    height: 76,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  comboLabel: { ...typography.label, fontSize: 12.5, fontWeight: '700' },
  comboSub: { ...typography.micro, fontSize: 10.5 },
  comboHint: { ...typography.caption, paddingHorizontal: spacing.base, paddingTop: spacing.sm },
  pressed: { opacity: 0.7 },

  // List summary (main screen) + photo thumbnails
  emptyList: { ...typography.caption, color: colors.muted },
  summaryLine: { ...typography.body },
  mutedLine: { ...typography.caption, color: colors.muted },
  summaryPhotos: { flexDirection: 'row', gap: spacing.sm },
  summaryThumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },

  // Paper-list photos (inside the Add-items modal)
  photoHead: { gap: 2 },
  photoHint: { ...typography.caption, color: colors.muted },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoCell: { position: 'relative' },
  photoThumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.surfaceSunken },
  photoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { flexDirection: 'row', gap: spacing.sm },
  photoFlex: { flex: 1 },

  // Receipt rows
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  itemNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  itemNumText: { ...typography.label, fontSize: 12, color: colors.primaryDeep },
  itemNumNoLabel: { marginTop: 12 },
  rowMain: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 30 },
  stepperNoLabel: { marginTop: 12 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: { ...typography.subhead, fontSize: 16, color: colors.text },
  stepQty: { ...typography.subhead, minWidth: 24, textAlign: 'center' },
  remove: { paddingTop: 38 },
  removeNoLabel: { paddingTop: 18 },
  fieldLabel: { ...typography.label, fontSize: 13, fontWeight: '600' },

  // Store grid
  storeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  storeTile: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  storeTileSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  storeMono: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeMonoSelected: { backgroundColor: colors.primary },
  storeMonoText: { ...typography.heading, color: colors.body },
  storeMonoTextSelected: { color: colors.onPrimary },
  storeLabel: { ...typography.label, fontSize: 12 },
  storeLabelSelected: { color: colors.primaryDeep },
  storeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sticky footer CTA: the single yellow action on screen.
  footerStack: { gap: spacing.sm },
  stickyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.base,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  stickyTotals: { flex: 1, gap: 1 },
  stickyCount: { ...typography.caption, fontWeight: '600', color: colors.text },
  stickyFeeNote: { ...typography.caption, color: colors.muted },
  stickyBtn: { minWidth: 148 },

  gpsActions: { flexDirection: 'row', gap: spacing.sm },
  gpsFlex: { flex: 1 },
  gpsBody: { ...typography.body },
  summaryCard: { borderColor: colors.primary, borderWidth: 1.5 },
  feeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feeLabel: { ...typography.subhead },
  feeValue: { ...typography.price, fontSize: 19 },
  finePrint: { ...typography.caption, textAlign: 'center' },

  findOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  rings: { width: 250, height: 250, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.primary },
  findMedallion: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderAvatar: { width: 112, height: 112, borderRadius: 56 },
  riderInitials: { ...typography.display, fontSize: 34, color: colors.onPrimary },
  riderBadges: { flexDirection: 'row', gap: spacing.sm },
  findTitle: { ...typography.display, fontSize: 26, color: colors.onPrimary, textAlign: 'center' },
  findSub: { ...typography.body, color: colors.onPrimary, opacity: 0.85, textAlign: 'center' },
  findOrder: {
    ...typography.subhead,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.onPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  findFeeDetail: { ...typography.caption, color: colors.onPrimary, opacity: 0.75, textAlign: 'center' },
  findActions: { gap: spacing.sm, alignSelf: 'stretch' },
});
