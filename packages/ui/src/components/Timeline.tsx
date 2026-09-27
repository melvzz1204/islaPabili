import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../tokens';

export type TimelineStep = {
  label: string;
  caption?: string;
  state: 'done' | 'current' | 'upcoming' | 'failed';
};

/** Vertical progress timeline for order tracking. */
export function Timeline({ steps, style }: { steps: TimelineStep[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const done = step.state === 'done' || step.state === 'current';
        const failed = step.state === 'failed';
        const dotColor = failed ? colors.danger : done ? colors.primary : colors.borderStrong;
        return (
          <View key={`${step.label}-${i}`} style={styles.row}>
            <View style={styles.gutter}>
              <View
                style={[
                  styles.dot,
                  { borderColor: dotColor },
                  done && styles.dotFilled,
                  failed && styles.dotFailed,
                  step.state === 'current' && styles.dotCurrent,
                ]}
              >
                {done && !failed ? <View style={styles.dotInner} /> : null}
              </View>
              {!last ? (
                <View style={[styles.line, { backgroundColor: step.state === 'done' ? colors.primary : colors.border }]} />
              ) : null}
            </View>
            <View style={[styles.body, last && styles.bodyLast]}>
              <Text
                style={[
                  styles.label,
                  step.state === 'upcoming' && styles.labelUpcoming,
                  failed && styles.labelFailed,
                  step.state === 'current' && styles.labelCurrent,
                ]}
              >
                {step.label}
              </Text>
              {step.caption ? <Text style={styles.caption}>{step.caption}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  gutter: { alignItems: 'center', width: 18 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    borderWidth: 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotFailed: { backgroundColor: colors.danger, borderColor: colors.danger },
  dotCurrent: { width: 18, height: 18, borderRadius: radius.full },
  dotInner: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: colors.onPrimary },
  line: { flex: 1, width: 2, marginVertical: 2 },
  body: { flex: 1, paddingBottom: spacing.base, gap: 1 },
  bodyLast: { paddingBottom: 0 },
  label: { ...typography.bodyStrong },
  labelCurrent: { color: colors.primary },
  labelUpcoming: { color: colors.faint },
  labelFailed: { color: colors.danger },
  caption: { ...typography.caption },
});
