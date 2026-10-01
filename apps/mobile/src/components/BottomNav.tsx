import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '@isla/supabase';
import { AppIcon, colors, typography, type AppIconName } from '@isla/ui';
import { goToTab, type RootNavProp, type TabParamList } from '../navigation/types';

type Item = { tab: keyof TabParamList; label: string; icon: AppIconName };

const ITEMS: Item[] = [
  { tab: 'Home', label: 'Home', icon: 'home' },
  { tab: 'Shop', label: 'Shop', icon: 'storefront' },
  { tab: 'Orders', label: 'Orders', icon: 'receipt' },
  { tab: 'Messages', label: 'Messages', icon: 'message' },
  { tab: 'Profile', label: 'Profile', icon: 'user' },
];

/** Fixed height so screens can reserve space via `footerHeight`. */
export const BOTTOM_NAV_HEIGHT = 64;

/** Best-effort read of the currently focused tab underneath this stack screen. */
function useActiveTab(): keyof TabParamList | null {
  const navigation = useNavigation<RootNavProp>();
  const [active, setActive] = useState<keyof TabParamList | null>(null);

  useFocusEffect(
    useCallback(() => {
      try {
        const state = navigation.getState();
        const tabsRoute = state?.routes?.find((r) => r.name === 'Tabs');
        const nested = tabsRoute?.state as
          | { routes?: { name?: string }[]; index?: number }
          | undefined;
        const name = nested?.routes?.[nested?.index ?? -1]?.name;
        setActive(
          name === 'Home' ||
            name === 'Shop' ||
            name === 'Orders' ||
            name === 'Messages' ||
            name === 'Profile'
            ? name
            : null,
        );
      } catch {
        setActive(null);
      }
    }, [navigation]),
  );

  return active;
}

/**
 * Bottom shortcut bar for pushed stack screens (Store, Cart, Checkout,
 * Notifications, Rider…), which sit above the tab bar. Tab screens already
 * render the native tab bar, so they must not mount this.
 */
export function BottomNav() {
  const navigation = useNavigation<RootNavProp>();
  const { session } = useAuth();
  const active = useActiveTab();

  // Guests only have the Shop tab, offer it plus a way into sign-in.
  if (!session) {
    return (
      <View style={styles.bar}>
        <NavItem
          label="Shop"
          icon="storefront"
          active={active === 'Shop'}
          onPress={() => goToTab(navigation, 'Shop')}
        />
        <NavItem
          label="Log in"
          icon="user"
          active={false}
          onPress={() => navigation.navigate('AuthHome')}
        />
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      {ITEMS.map((item) => (
        <NavItem
          key={item.tab}
          label={item.label}
          icon={item.icon}
          active={active === item.tab}
          onPress={() => goToTab(navigation, item.tab)}
        />
      ))}
    </View>
  );
}

function NavItem({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: AppIconName;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size={22} color={active ? colors.primary : colors.faint} />
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: BOTTOM_NAV_HEIGHT,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { ...typography.micro, fontSize: 10.5, fontWeight: '600', color: colors.faint },
  labelActive: { color: colors.primary },
  pressed: { opacity: 0.7 },
});
