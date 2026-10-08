import { NavigationContainer, DarkTheme, createNavigationContainerRef, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { isNoTowns, resolveOptedTowns } from '@isla/shared';
import { AuthProvider, useAuth } from '@isla/supabase';
import { AppIcon, colors, radius, spacing, typography } from '@isla/ui';
import { supabase } from './src/lib/supabase';
import { ToastProvider } from './src/ui/Toast';
import { CartProvider } from './src/marketplace/cart';
import { AuthModeProvider, useAuthMode } from './src/lib/authMode';
import { consumeCheckoutReturn } from './src/lib/checkoutReturn';
import { registerPushToken } from './src/lib/push';
import { useConversations, useIncomingMessageAlerts } from './src/messaging/chat';
import { useOrderUpdateAlerts } from './src/lib/orderAlerts';
import { initNotifications, getPromoTarget, scheduleAlakSingko, scheduleDailyCraving, setPendingRiderTab } from './src/lib/notify';
import type { RootStackParamList, TabParamList } from './src/navigation/types';
import AuthHomeScreen from './src/screens/auth/AuthHomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import PhoneScreen from './src/screens/auth/PhoneScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import WelcomeOnboardingScreen, { WELCOME_SEEN_KEY } from './src/screens/WelcomeOnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import LandingScreen from './src/screens/LandingScreen';
import MarketScreen from './src/screens/MarketScreen';
import StoreScreen from './src/screens/StoreScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import PabiliCreateScreen from './src/screens/PabiliCreateScreen';
import JollibeeMenuScreen from './src/screens/JollibeeMenuScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ChatScreen from './src/screens/ChatScreen';
import TrackScreen from './src/screens/TrackScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { OtaPrompt, UpdatePrompt } from './src/components/UpdatePrompt';
import NotificationsScreen from './src/screens/NotificationsScreen';
import RiderGateScreen from './src/screens/RiderGateScreen';
import MerchantGateScreen from './src/screens/MerchantGateScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const navigationTheme: Theme = {
  ...DarkTheme,
  dark: false,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.hairline,
    notification: colors.accent,
  },
};

const TAB_ICON = {
  Home: 'home',
  Shop: 'storefront',
  Orders: 'receipt',
  Messages: 'message',
  Profile: 'user',
} as const;

function TabBarIcon({
  route,
  focused,
}: {
  route: keyof typeof TAB_ICON;
  focused: boolean;
}) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      <AppIcon
        name={TAB_ICON[route]}
        size={21}
        color={focused ? colors.primary : colors.faint}
        weight={focused ? 'fill' : 'regular'}
      />
    </View>
  );
}

/**
 * Guest mode collapses the tabs to a single prototype landing with no tab bar
 * (no stores listed); signed-in users get the full five-tab layout
 * (Home, Shop, Orders, Messages, Profile).
 */
function MainTabs({ guest }: { guest: boolean }) {
  const { conversations } = useConversations('customer');
  // Live banner for incoming rider messages, anywhere in the customer shell.
  useIncomingMessageAlerts('customer');
  // Toast + tray + sound for every order status notification.
  useOrderUpdateAlerts();
  const unread = guest ? 0 : conversations.filter((c) => c.unread).length;
  if (guest) {
    return (
      <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={() => null}>
        <Tabs.Screen name="Shop" component={LandingScreen} />
      </Tabs.Navigator>
    );
  }
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => <TabBarIcon route={route.name} focused={focused} />,
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Shop" component={MarketScreen} />
      <Tabs.Screen name="Orders" component={OrdersScreen} />
      <Tabs.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarBadge: unread > 0 ? unread : undefined }}
      />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

function LoadingGate() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function Root() {
  const { client, session, loading, profile, profileLoading } = useAuth();
  const { mode, loaded: modeLoaded, loggedOut, setLoggedOut } = useAuthMode();
  const wasSession = useRef(false);
  const pushRegistered = useRef<string | null>(null);
  // First-launch welcome for guests. null = still reading storage.
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((v) => {
        if (active) setWelcomeSeen(v === '1');
      })
      .catch(() => {
        if (active) setWelcomeSeen(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Register this device for server-side wake-up pushes. Re-runs on every
  // foreground so a refreshed (or previously denied) Expo token still lands
  // in push_tokens — this is what wakes minimized/killed apps.
  useEffect(() => {
    const uid = session?.user?.id ?? null;
    if (!uid) {
      pushRegistered.current = null;
      return;
    }
    pushRegistered.current = uid;
    void registerPushToken(client, uid);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void registerPushToken(client, uid);
    });
    return () => sub.remove();
  }, [client, session]);

  // A rider/merchant logout parks on the sign-in page (not guest home) so
  // logging back in is one tap. Any fresh login clears the flag.
  useEffect(() => {
    if (wasSession.current && !session && (mode === 'rider' || mode === 'merchant')) {
      setLoggedOut(true);
    } else if (session) {
      setLoggedOut(false);
    }
    wasSession.current = !!session;
  }, [session, mode, setLoggedOut]);

  if (loading || !modeLoaded || (session && profileLoading) || (!session && welcomeSeen === null)) {
    return <LoadingGate />;
  }

  // Rider mode is a separate shell: no customer tabs, no onboarding.
  // Switching back to customer always goes through logout.
  if (session && mode === 'rider') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="Rider" component={RiderGateScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
      </Stack.Navigator>
    );
  }

  // Merchant mode is a separate shell: store dashboard only.
  // Switching back to customer always goes through logout.
  if (session && mode === 'merchant') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="Merchant" component={MerchantGateScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
      </Stack.Navigator>
    );
  }

  // Just logged out from rider mode → sign-in landing so logging back
  // in is one tap.
  if (!session && loggedOut) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="AuthHome" component={AuthHomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Phone" component={PhoneScreen} />
      </Stack.Navigator>
    );
  }

  // First launch for guests: show the welcome carousel once, then never
  // again. Returning users (signed in, or parked on sign-in after a rider
  // logout) skip it.
  if (!session && !loggedOut && !welcomeSeen) {
    return <WelcomeOnboardingScreen onDone={() => setWelcomeSeen(true)} />;
  }

  // A guest who tapped "log in to checkout" lands straight on Checkout.
  const toCheckout = Boolean(session) && consumeCheckoutReturn();

  // Onboarding always wins: a half-finished profile blocks checkout validation.
  if (session) {
    // resolveOptedTowns falls back to home_town for pre-migration rows.
    if (profile?.phone == null || isNoTowns(resolveOptedTowns(profile))) {
      return <OnboardingScreen />;
    }
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
      initialRouteName={toCheckout ? 'Checkout' : 'Tabs'}
    >
      <Stack.Screen name="Tabs">
        {() => <MainTabs guest={!session} />}
      </Stack.Screen>
      <Stack.Screen name="Store" component={StoreScreen} />
      <Stack.Screen name="Market" component={MarketScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="PabiliCreate" component={PabiliCreateScreen} />
      <Stack.Screen name="JollibeeMenu" component={JollibeeMenuScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Track" component={TrackScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Rider" component={RiderGateScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="AuthHome" component={AuthHomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Phone" component={PhoneScreen} />
    </Stack.Navigator>
  );
}

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

function goToPromoTarget(data: unknown) {
  if (!navigationRef.isReady()) return;
  const target = getPromoTarget(data);
  if (!target) return;
  try {
    if (target.name === 'pabili-pulutan') {
      // 5PM: straight to pre-filled pulutan Pabili form.
      navigationRef.navigate('PabiliCreate', { comboId: target.comboId } as never);
    } else {
      // 11AM: Shop tab.
      navigationRef.navigate('Tabs', { screen: 'Shop' } as never);
    }
  } catch {
    // Rider/merchant shells lack these routes — fall back to Shop tab.
    try {
      navigationRef.navigate('Tabs', { screen: 'Shop' } as never);
    } catch {
      // Best-effort only.
    }
  }
}

/**
 * Background-push tap from push-send (`{ orderId, kind: 'pabili' }`): a
 * minimized/killed rider app opens straight onto the Requests tab so the
 * offer is one tap away. The tab handoff is consumed by RiderHomeScreen.
 */
function goToRiderRequest() {
  setPendingRiderTab('requests');
  if (!navigationRef.isReady()) return;
  try {
    navigationRef.navigate('Rider' as never);
  } catch {
    // Rider shell may not be mounted (customer mode) — handoff stays pending.
  }
}

function handlePushTap(data: unknown) {
  if (!data || typeof data !== 'object') return;
  const kind = (data as Record<string, unknown>).kind;
  if (kind === 'pabili') {
    goToRiderRequest();
    return;
  }
  goToPromoTarget(data);
}

export default function App() {
  // Expo web serves a generic shell whose <title> resolves to "undefined";
  // pin a real tab title (per-screen titles can extend this later).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'IslaPabili';
    }
  }, []);
  // Notification channels + foreground banner/sound, once per launch.
  useEffect(() => {
    void initNotifications();
    // Daily 11AM lunch-craving nudge (local-scheduled, best-effort).
    void scheduleDailyCraving();
    // Daily 5PM alak-singko pulutan nudge (local-scheduled, best-effort).
    void scheduleAlakSingko();
  }, []);
  // Push tap routing: promo → Shop/Pabili, rider `pabili` push → Requests tab.
  // Covers cold start (killed app) + taps while running/minimized.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    const isRoutable = (data: unknown) => {
      if (!data || typeof data !== 'object') return false;
      const kind = (data as Record<string, unknown>).kind;
      return kind === 'pabili' || getPromoTarget(data) !== null;
    };
    // Killed-app launch: notification tap opened the app but nav wasn't ready yet.
    // Poll briefly until navigation is ready, then jump.
    void (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data = last?.notification.request.content.data;
        if (alive && data && isRoutable(data)) {
          for (let i = 0; i < 20 && alive; i++) {
            if (navigationRef.isReady()) {
              handlePushTap(data);
              break;
            }
            await new Promise((r) => setTimeout(r, 250));
          }
        }
      } catch {
        // Tap routing is best-effort.
      }
    })();
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        handlePushTap(response.notification.request.content.data);
      } catch {
        // Ignore.
      }
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider client={supabase}>
          <AuthModeProvider>
            <CartProvider>
              <NavigationContainer ref={navigationRef} theme={navigationTheme}>
                <Root />
                <OtaPrompt />
                <UpdatePrompt />
              </NavigationContainer>
            </CartProvider>
          </AuthModeProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: spacing.xs + 2,
  },
  tabBarItem: { gap: 2 },
  tabLabel: { ...typography.micro, fontSize: 10.5, fontWeight: '600' },
  tabIconWrap: {
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: { backgroundColor: colors.primaryTint },
});
