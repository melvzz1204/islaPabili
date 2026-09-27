import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '../tokens';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastOptions = {
  message: string;
  type?: ToastType;
  duration?: number;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 2600;
const ANIMATION_DURATION = 240;

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

const ACCENT: Record<ToastType, string> = {
  success: colors.success,
  error: colors.danger,
  warning: colors.warn,
  info: colors.info,
};

export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<{ message: string; type: ToastType; id: number } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setCurrent(null);
    });
  }, [progress]);

  const showToast = useCallback(
    (options: ToastOptions) => {
      idRef.current += 1;
      const id = idRef.current;
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      setCurrent({ message: options.message, type: options.type ?? 'info', id });
      progress.setValue(0);
      Animated.spring(progress, {
        toValue: 1,
        useNativeDriver: true,
        damping: 16,
        stiffness: 200,
        mass: 0.8,
      }).start();
      hideTimer.current = setTimeout(dismiss, options.duration ?? DEFAULT_DURATION);
    },
    [dismiss, progress],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current ? (
        <View style={[styles.overlay, { bottom: insets.bottom + spacing.xl }]} pointerEvents="box-none">
          <Pressable onPress={dismiss}>
            <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }, { scale }] }]}>
              <View style={[styles.icon, { backgroundColor: ACCENT[current.type] }]}>
                <Text style={styles.iconText}>{ICONS[current.type]}</Text>
              </View>
              <Text style={styles.message}>{current.message}</Text>
            </Animated.View>
          </Pressable>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '92%',
    backgroundColor: colors.toastBg,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    ...shadows.toast,
  },
  icon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  message: {
    flexShrink: 1,
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
