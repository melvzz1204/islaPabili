import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../tokens';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Pulsing placeholder block used while content loads. */
export function Skeleton({ width = '100%', height = 14, borderRadius = radius.sm, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: colors.skeleton, opacity }, style]} />;
}

/** Multi-line text placeholder; the last line is intentionally short. */
export function SkeletonText({ lines = 2, width = '100%' }: { lines?: number; width?: number | `${number}%` }) {
  return (
    <View style={styles.textWrap}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 && lines > 1 ? '62%' : width} height={11} />
      ))}
    </View>
  );
}

/** Store row placeholder mirroring MerchantCard's layout. */
export function SkeletonStoreRow() {
  return (
    <View style={styles.storeRow}>
      <Skeleton width={64} height={64} borderRadius={radius.lg} />
      <View style={styles.storeBody}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="80%" height={11} />
        <Skeleton width="35%" height={18} borderRadius={radius.xs} />
      </View>
    </View>
  );
}

/** Product grid tile placeholder. */
export function SkeletonProductTile() {
  return (
    <View style={styles.tile}>
      <Skeleton width="100%" height={104} borderRadius={radius.md} />
      <View style={styles.tileBody}>
        <Skeleton width="90%" height={12} />
        <Skeleton width="55%" height={12} />
        <Skeleton width="45%" height={16} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  textWrap: { gap: 6 },
  storeRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  storeBody: { flex: 1, gap: 7 },
  tile: { flex: 1, gap: 8 },
  tileBody: { gap: 6 },
});
