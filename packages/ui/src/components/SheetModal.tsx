import type { PropsWithChildren, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../icons';
import { colors, radius, shadows, spacing, typography } from '../tokens';

type SheetModalProps = PropsWithChildren<{
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  /** Fraction of screen height the sheet may occupy. */
  maxHeightRatio?: number;
}>;

/** Bottom sheet with drag handle, tappable backdrop and safe-area padding. */
export function SheetModal({
  visible,
  title,
  subtitle,
  children,
  onClose,
  footer,
  maxHeightRatio = 0.88,
}: SheetModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, shadows.sheet, { maxHeight: `${maxHeightRatio * 100}%` }]}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                hitSlop={10}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              >
                <AppIcon name="close" size={14} color={colors.body} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>{footer}</View>
          ) : (
            <View style={{ height: Math.max(insets.bottom, spacing.base) }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  title: { ...typography.title, fontSize: 20 },
  subtitle: { ...typography.caption },
  close: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: spacing.pagePadding, paddingBottom: spacing.base, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.6 },
});
