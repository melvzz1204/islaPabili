import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { isNoTowns, resolveOptedTowns } from '@isla/shared';
import { AuthProvider, useAuth } from '@isla/supabase';
import { AppIcon, colors, radius, spacing, typography } from '@isla/ui';
import { supabase } from './src/lib/supabase';
import { ToastProvider } from './src/ui/Toast';
import { CartProvider } from './src/marketplace/cart';
import { AuthModeProvider, useAuthMode } from './src/lib/authMode';
import { consumeCheckoutReturn } from './src/lib/checkoutReturn';
import type { RootStackParamList, TabParamList } from './src/navigation/types';
import AuthHomeScreen from './src/screens/auth/AuthHomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import PhoneScreen from './src/screens/auth/PhoneScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import MarketScreen from './src/screens/MarketScreen';
import StoreScreen from './src/screens/StoreScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import PabiliCreateScreen from './src/screens/PabiliCreateScreen';
import JollibeeMenuScreen from './src/screens/JollibeeMenuScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import RiderGateScreen from './src/screens/RiderGateScreen';
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
 * Guest mode collapses the tabs to a single `Shop` destination with no tab bar;
 * signed-in users get the full four-tab layout.
 */
function MainTabs({ guest }: { guest: boolean }) {
  if (guest) {
    return (
      <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={() => null}>
        <Tabs.Screen name="Shop" component={MarketScreen} />
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
  const { session, loading, profile, profileLoading } = useAuth();
  const { mode, loaded: modeLoaded } = useAuthMode();

  if (loading || !modeLoaded || (session && profileLoading)) {
    return <LoadingGate />;
  }

  // Rider mode is a separate shell: no customer tabs, no onboarding.
  // Switching back to customer always goes through logout.
  if (session && mode === 'rider') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="Rider" component={RiderGateScreen} />
      </Stack.Navigator>
    );
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
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="PabiliCreate" component={PabiliCreateScreen} />
      <Stack.Screen name="JollibeeMenu" component={JollibeeMenuScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Rider" component={RiderGateScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="AuthHome" component={AuthHomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Phone" component={PhoneScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  // Expo web serves a generic shell whose <title> resolves to "undefined";
  // pin a real tab title (per-screen titles can extend this later).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'IslaPabili';
    }
  }, []);
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider client={supabase}>
          <AuthModeProvider>
            <CartProvider>
              <NavigationContainer theme={navigationTheme}>
                <Root />
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
