import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SUPPORTED_TOWNS, TOWN_LABELS, type Town } from '@isla/shared';
import { colors, radius, spacing } from './theme';

type TownPickerProps = {
  value: Town | null;
  onChange: (town: Town) => void;
};

export function TownPicker({ value, onChange }: TownPickerProps) {
  return (
    <View style={styles.grid}>
      {SUPPORTED_TOWNS.map((town) => {
        const selected = value === town;
        return (
          <Pressable
            key={town}
            accessibilityRole="button"
            onPress={() => onChange(town)}
            style={[styles.chip, selected ? styles.chipSelected : styles.chipIdle]}
          >
            <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : styles.chipLabelIdle]}>
              {TOWN_LABELS[town]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { fontSize: 15, fontWeight: '600' },
  chipLabelIdle: { color: colors.text },
  chipLabelSelected: { color: '#FFFFFF' },
});