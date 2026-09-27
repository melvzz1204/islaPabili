import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../tokens';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  keyboard?: boolean;
  padding?: number;
  gap?: number;
  /** Pinned to the bottom above the safe area (cart bars, CTAs). */
  footer?: ReactNode;
  /** Extra bottom padding so scrollable content clears `footer`. */
  footerHeight?: number;
  edges?: Edge[];
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}>;

/** App page scaffold. Safe areas, keyboard avoidance and optional sticky footer. */
export function Screen({
  children,
  scroll = true,
  keyboard = true,
  padding = spacing.pagePadding,
  gap = spacing.base,
  footer,
  footerHeight = 0,
  edges = ['top'],
  background = colors.bg,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const container = [
    styles.content,
    { padding, gap },
    footer ? { paddingBottom: padding + footerHeight + insets.bottom } : null,
    contentStyle,
  ];

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, container]}>{children}</View>
  );

  const wrapped = keyboard ? (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: background }]} edges={edges}>
      {wrapped}
      {footer ? <SafeAreaView edges={['bottom']} style={styles.footer}>{footer}</SafeAreaView> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {},
  footer: { width: '100%' },
});
