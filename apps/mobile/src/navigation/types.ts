import type { NavigatorScreenParams } from '@react-navigation/native';
import { StackActions, type NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';

/**
 * The app uses ONE navigator tree for every auth state, so cross-cutting
 * navigation (`navigate('Tabs', { screen: 'Shop' })`) resolves identically for
 * guests and signed-in users. `Tabs` renders fewer tabs when signed out.
 */
export type TabParamList = {
  Home: undefined;
  Shop: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Store: { merchantId: string };
  Cart: undefined;
  Checkout: undefined;
  Notifications: undefined;
  Rider: undefined;
  Onboarding: undefined;
  AuthHome: undefined;
  Login: undefined;
  Register: undefined;
  Phone: undefined;
};

/** Pre-login-only routes. Browsing the catalog is public. */
export type AuthStackParamList = {
  AuthHome: undefined;
  Login: undefined;
  Register: undefined;
  Phone: undefined;
};

export type RootStackScreen<Route extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Route>;

export type TabScreen<Route extends keyof TabParamList> = BottomTabScreenProps<TabParamList, Route>;

/** Navigation prop for screens mounted in the root stack. */
export type RootNavProp = CompositeNavigationProp<
  NativeStackScreenProps<RootStackParamList>['navigation'],
  BottomTabScreenProps<TabParamList>['navigation']
>;

/**
 * Root-stack screens never navigate to a tab directly — the tab list differs
 * between guest and signed-in modes, so always go through this helper.
 */
export function toTab(screen: keyof TabParamList) {
  return { screen };
}

/**
 * Jump to a tab from a pushed stack screen (Store, Cart, Checkout,
 * Notifications, Rider…).
 *
 * This pops instead of `navigate('Tabs', …)`: in React Navigation 7 navigating
 * to a non-focused stack route pushes a duplicate Tabs route, so repeated
 * trips pile up `[Tabs, Rider, Tabs, …]` and landing on the previously focused
 * tab can look like the button did nothing.
 */
export function goToTab(
  navigation: { dispatch: (action: NavigationAction) => void },
  screen: keyof TabParamList,
) {
  navigation.dispatch(StackActions.popTo('Tabs', toTab(screen)));
}

/**
 * Return from a pushed flow (Rider, Store, Checkout…) to the store list.
 * Shorthand for `goToTab(navigation, 'Shop')`.
 */
export function backToShopping(navigation: { dispatch: (action: NavigationAction) => void }) {
  goToTab(navigation, 'Shop');
}
