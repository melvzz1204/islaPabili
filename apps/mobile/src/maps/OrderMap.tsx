import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { AppIcon, colors, radius, shadows, spacing, typography } from '@isla/ui';
import { buildMapHtml, type LatLng } from './leafletHtml';
import { searchPlaces, type NominatimResult } from './geocode';

export type { LatLng };

/** Boac town plaza, sensible default view over Marinduque. */
export const MARINDUQUE_CENTER: LatLng = { lat: 13.4485, lng: 121.8397 };

/** Imperative camera controls for embedding screens (bottom sheets, etc.). */
export type MapActions = { fit: () => void; locate: () => void };

type Props = {
  self: LatLng | null;
  other: LatLng | null;
  selfLabel?: string;
  otherLabel?: string;
  initialCenter?: LatLng;
  showSearch?: boolean;
  /** Offset the floating search bar (e.g. below a screen overlay header). */
  searchTop?: number;
  /** Hide the built-in toolbar when the host renders its own actions. */
  showToolbar?: boolean;
  /** Host access to fit/locate without the built-in toolbar. */
  actionsRef?: MutableRefObject<MapActions | null>;
  onMessagePress?: () => void;
  onCallPress?: () => void;
};

/**
 * Reference layout: floating search bar on top, full-bleed Leaflet map,
 * floating toolbar pill at the bottom (locate · fit · layers · message · call).
 * Free OpenStreetMap tiles, no API key, works in Expo Go + web.
 */
export function OrderMap({
  self,
  other,
  selfLabel = 'You',
  otherLabel = 'Rider',
  initialCenter,
  showSearch = true,
  searchTop,
  showToolbar = true,
  actionsRef,
  onMessagePress,
  onCallPress,
}: Props) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const fitted = useRef(false);

  const start = useMemo(
    () => self ?? other ?? initialCenter ?? MARINDUQUE_CENTER,
    // Initial camera only, live ticks move pins, not the camera.
    [],
  );
  const html = useMemo(() => buildMapHtml(start), [start]);

  const run = (js: string) => {
    webRef.current?.injectJavaScript(js);
  };

  const pushPoints = (fit: boolean) => {
    const s = self ? `{lat:${self.lat},lng:${self.lng}}` : 'null';
    const o = other ? `{lat:${other.lat},lng:${other.lng}}` : 'null';
    run(`window.IslaMap.setPoints(${s},${JSON.stringify(selfLabel)},${o},${JSON.stringify(otherLabel)},${fit});true;`);
  };

  // Push pins when ready and on every location tick (fit only the first time).
  useEffect(() => {
    if (!ready) return;
    const fit = !fitted.current && (!!self || !!other);
    if (fit) fitted.current = true;
    pushPoints(fit);
  }, [ready, self?.lat, self?.lng, other?.lat, other?.lng]);

  // Debounced place search (Nominatim, Marinduque-biased).
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      void searchPlaces(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 500);
    return () => clearTimeout(t);
  }, [query]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string };
      if (msg.type === 'ready') setReady(true);
    } catch {
      // Ignore non-JSON map events.
    }
  };

  const pickResult = (r: NominatimResult) => {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    run(`window.IslaMap.showSearch(${lat},${lng},${JSON.stringify(r.display_name.split(',')[0] ?? 'Pin')});true;`);
    setResults([]);
    setQuery(r.display_name.split(',').slice(0, 2).join(','));
  };

  const fitAll = () => run('window.IslaMap.fitAll();true;');

  const locateMe = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      run(`window.IslaMap.locate(${pos.coords.latitude},${pos.coords.longitude});true;`);
    } catch {
      // Stay on the current camera when GPS is unavailable.
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (actionsRef) actionsRef.current = { fit: fitAll, locate: () => void locateMe() };
  }, []);

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      />

      {showSearch ? (
        <View style={[styles.searchFloat, searchTop != null && { top: searchTop }]}>
          <View style={styles.searchBar}>
            <AppIcon name="search" size={18} color={colors.faint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search any location"
              placeholderTextColor={colors.faint}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : query.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => {
                  setQuery('');
                  setResults([]);
                  run('window.IslaMap.clearSearch();true;');
                }}
              >
                <AppIcon name="close" size={18} color={colors.faint} />
              </Pressable>
            ) : null}
          </View>
          {results.length > 0 ? (
            <View style={styles.results}>
              {results.map((r) => (
                <Pressable
                  key={`${r.lat},${r.lon}`}
                  accessibilityRole="button"
                  onPress={() => pickResult(r)}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                >
                  <AppIcon name="pin" size={16} color={colors.primary} />
                  <Text style={styles.resultText} numberOfLines={2}>
                    {r.display_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {showToolbar ? (
        <View style={styles.toolbarFloat} pointerEvents="box-none">
          <View style={styles.toolbar}>
            <ToolButton
              label={locating ? 'Locating…' : 'Locate me'}
              icon="locate"
              onPress={() => void locateMe()}
            />
            <ToolButton label="Fit both" icon="route" onPress={fitAll} />
            <ToolButton label="Map style" icon="layers" onPress={() => run('window.IslaMap.toggleLayer();true;')} />
            {onMessagePress ? <ToolButton label="Message" icon="message" onPress={onMessagePress} /> : null}
            {onCallPress ? <ToolButton label="Call" icon="call" onPress={onCallPress} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ToolButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: 'locate' | 'route' | 'layers' | 'message' | 'call';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size={21} color={colors.primaryDeep} />
      <Text style={styles.toolLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  web: { flex: 1, backgroundColor: '#e8f0ec' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },

  searchFloat: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.base,
    right: spacing.base,
    gap: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.base,
    height: 48,
    ...shadows.sticky,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text },
  results: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sticky,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  resultText: { ...typography.body, flex: 1 },

  toolbarFloat: { position: 'absolute', bottom: spacing.base, left: 0, right: 0, alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sticky,
  },
  tool: { alignItems: 'center', gap: 1, paddingHorizontal: spacing.sm, paddingVertical: 2, minWidth: 56 },
  toolLabel: { ...typography.micro, fontSize: 9.5, color: colors.muted, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
