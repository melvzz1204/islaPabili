import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@isla/ui';
import { TextField } from '../ui/TextField';
import { searchPlaces, shortenPlaceName, type NominatimResult } from './geocode';

type Props = {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Fires with the raw Nominatim row when the user picks a suggestion (coords included). */
  onPickSuggestion?: (place: NominatimResult) => void;
  multiline?: boolean;
};

/**
 * Drop-off address field with live Nominatim suggestions (Marinduque-biased).
 * Typing 3+ chars debounces a search; tapping a row fills the field and
 * hands the raw result (with lat/lon) to `onPickSuggestion` for GPS pinning.
 */
export function AddressAutocomplete({
  label = 'Address',
  placeholder = 'Street / barangay / landmark',
  value,
  onChangeText,
  onPickSuggestion,
  multiline,
}: Props) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleChange = (v: string) => {
    onChangeText(v);
    if (timer.current) clearTimeout(timer.current);
    const q = v.trim();
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    setOpen(true);
    timer.current = setTimeout(() => {
      void searchPlaces(q)
        .then((rows) => {
          if (seq.current !== id) return;
          setResults(rows);
          setSearching(false);
        })
        .catch(() => {
          if (seq.current !== id) return;
          setSearching(false);
        });
    }, 500);
  };

  return (
    <View>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={handleChange}
        multiline={multiline}
      />
      {open ? (
        <View style={styles.drop}>
          {searching && results.length === 0 ? (
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.muted}>Searching places…</Text>
            </View>
          ) : null}
          {!searching && results.length === 0 ? (
            <Text style={styles.muted}>No matches — keep typing, barangay + town helps.</Text>
          ) : null}
          {results.map((r, i) => {
            const short = shortenPlaceName(r.display_name);
            return (
              <Pressable
                key={`${r.lat}-${r.lon}-${i}`}
                onPress={() => {
                  onChangeText(short);
                  setResults([]);
                  setOpen(false);
                  onPickSuggestion?.(r);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Use ${short}`}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {short}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {r.display_name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  drop: {
    marginTop: -spacing.xs,
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  muted: { ...typography.caption, color: colors.muted },
  row: { gap: 1, paddingVertical: spacing.xs },
  rowTitle: { ...typography.body, fontWeight: '600' },
  rowSub: { ...typography.caption, color: colors.muted },
  pressed: { opacity: 0.6 },
});
