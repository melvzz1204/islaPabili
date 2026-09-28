import type { ComponentType } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors } from './tokens';

/**
 * Centralized vector-icon mapping (Material Community Icons + FontAwesome
 * via @expo/vector-icons — fonts load at runtime through expo-font, so this
 * stays OTA-safe with no native rebuild).
 * Screens reference `AppIcon` names — never import icon sets directly — so
 * icon set/glyph/color changes propagate from here.
 *
 * NOTE: vector glyphs are single-style (no duotone/fill weights like the
 * previous set). The `weight` prop on AppIcon is accepted for API
 * compatibility but intentionally ignored — active/emphasis states are
 * expressed through `color`.
 */

type VectorIconComponent = ComponentType<{
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}>;

const MCI = MaterialCommunityIcons as unknown as VectorIconComponent;
const FA = FontAwesome as unknown as VectorIconComponent;

type IconEntry = { set: VectorIconComponent; glyph: string };

const mci = (glyph: string): IconEntry => ({ set: MCI, glyph });
const fa = (glyph: string): IconEntry => ({ set: FA, glyph });

export const iconMap = {
  // Navigation
  home: mci('home'),
  shop: mci('storefront'),
  storefront: mci('storefront'),
  cart: mci('cart'),
  orders: mci('receipt'),
  receipt: mci('receipt'),
  user: mci('account'),
  profile: mci('account'),

  // Documents
  camera: mci('camera'),
  image: mci('image'),

  // Commerce
  pabili: mci('shopping'),
  package: mci('package-variant'),
  tag: mci('tag'),
  gift: mci('gift'),
  heart: mci('heart'),
  rating: mci('star'),
  add: mci('plus-circle'),
  minus: mci('minus'),
  close: mci('close'),
  trash: mci('trash-can-outline'),
  edit: mci('pencil'),
  verified: mci('check-decagram'),

  // Categories
  categoryPharmacy: mci('pill'),
  categoryFood: mci('food-fork-drink'),
  categoryCoffee: mci('coffee'),
  categoryGrocery: mci('basket'),
  categoryRetail: mci('shopping-outline'),
  categoryDelivery: mci('truck'),

  // Actions
  search: mci('magnify'),
  filter: mci('filter-variant'),
  layers: mci('layers'),
  locate: mci('crosshairs-gps'),
  message: mci('message-text-outline'),
  chat: mci('chat-outline'),
  send: mci('send'),
  check: mci('check'),
  checkCircle: mci('check-circle'),
  chevronRight: mci('chevron-right'),
  chevronLeft: mci('chevron-left'),
  chevronDown: mci('chevron-down'),
  back: mci('arrow-left'),
  list: mci('format-list-bulleted'),
  settings: mci('cog'),
  support: mci('headset'),

  // Rider / delivery
  rider: mci('motorbike'),
  scooter: mci('moped'),
  route: mci('navigation'),
  earnings: mci('trending-up'),
  wallet: mci('wallet'),
  bank: mci('bank'),
  pay: mci('credit-card'),
  users: mci('account-group'),

  // Status / meta
  clock: mci('clock'),
  timer: mci('timer'),
  trending: mci('fire'),
  warning: mci('alert'),
  info: mci('information'),
  shield: mci('shield-check'),
  spark: mci('creation'),
  logout: mci('logout'),
  pin: mci('map-marker'),
  call: mci('phone-in-talk'),
  bell: mci('bell'),

  // Account
  lock: mci('lock'),
  eye: mci('eye'),
  eyeOff: mci('eye-off'),
  email: mci('email'),
  phone: mci('phone'),
  google: fa('google'),
  facebook: fa('facebook'),
} as const satisfies Record<string, IconEntry>;

export type AppIconName = keyof typeof iconMap;

export const iconDefaults: Record<
  AppIconName,
  { color: string; style: 'duotone' | 'fill' | 'regular' | 'bold' }
> = {
  home: { color: colors.text, style: 'duotone' },
  shop: { color: colors.text, style: 'duotone' },
  cart: { color: colors.text, style: 'duotone' },
  orders: { color: colors.text, style: 'duotone' },
  receipt: { color: colors.text, style: 'duotone' },
  user: { color: colors.text, style: 'duotone' },
  profile: { color: colors.text, style: 'duotone' },
  camera: { color: colors.primary, style: 'duotone' },
  image: { color: colors.primary, style: 'duotone' },
  storefront: { color: colors.text, style: 'duotone' },

  pabili: { color: colors.accent, style: 'duotone' },
  package: { color: colors.muted, style: 'duotone' },
  tag: { color: colors.muted, style: 'regular' },
  gift: { color: colors.accent, style: 'duotone' },
  heart: { color: colors.danger, style: 'duotone' },
  rating: { color: colors.warn, style: 'fill' },
  add: { color: colors.accent, style: 'fill' },
  minus: { color: colors.primary, style: 'bold' },
  close: { color: colors.muted, style: 'bold' },
  trash: { color: colors.danger, style: 'regular' },
  edit: { color: colors.body, style: 'regular' },
  verified: { color: colors.primary, style: 'fill' },

  // Categories
  categoryPharmacy: { color: colors.danger, style: 'duotone' },
  categoryFood: { color: colors.accent, style: 'duotone' },
  categoryCoffee: { color: colors.warnDark, style: 'duotone' },
  categoryGrocery: { color: colors.success, style: 'duotone' },
  categoryRetail: { color: colors.primary, style: 'duotone' },
  categoryDelivery: { color: colors.text, style: 'duotone' },

  search: { color: colors.muted, style: 'regular' },
  filter: { color: colors.text, style: 'regular' },
  layers: { color: colors.text, style: 'regular' },
  locate: { color: colors.text, style: 'regular' },
  message: { color: colors.text, style: 'regular' },
  chat: { color: colors.text, style: 'regular' },
  send: { color: colors.onPrimary, style: 'fill' },
  check: { color: colors.onPrimary, style: 'bold' },
  checkCircle: { color: colors.success, style: 'fill' },
  chevronRight: { color: colors.faint, style: 'bold' },
  chevronLeft: { color: colors.text, style: 'bold' },
  chevronDown: { color: colors.muted, style: 'bold' },
  back: { color: colors.text, style: 'bold' },
  list: { color: colors.text, style: 'regular' },
  settings: { color: colors.text, style: 'regular' },
  support: { color: colors.body, style: 'duotone' },

  rider: { color: colors.accent, style: 'fill' },
  scooter: { color: colors.accent, style: 'duotone' },
  route: { color: colors.primary, style: 'fill' },
  earnings: { color: colors.success, style: 'duotone' },
  wallet: { color: colors.success, style: 'duotone' },
  bank: { color: colors.text, style: 'duotone' },
  pay: { color: colors.text, style: 'duotone' },
  users: { color: colors.text, style: 'duotone' },

  clock: { color: colors.muted, style: 'regular' },
  timer: { color: colors.primary, style: 'duotone' },
  trending: { color: colors.accent, style: 'fill' },
  warning: { color: colors.warn, style: 'fill' },
  info: { color: colors.primary, style: 'fill' },
  shield: { color: colors.success, style: 'duotone' },
  spark: { color: colors.accent, style: 'fill' },
  logout: { color: colors.danger, style: 'regular' },
  pin: { color: colors.primary, style: 'fill' },
  call: { color: colors.success, style: 'fill' },
  bell: { color: colors.text, style: 'regular' },

  lock: { color: colors.muted, style: 'regular' },
  eye: { color: colors.muted, style: 'fill' },
  eyeOff: { color: colors.muted, style: 'fill' },
  email: { color: colors.muted, style: 'regular' },
  phone: { color: colors.muted, style: 'regular' },
  // Brand logos keep their official colors (not theme tokens).
  google: { color: '#4285F4', style: 'regular' },
  facebook: { color: '#1877F2', style: 'fill' },
};

export function AppIcon({
  name,
  size = 24,
  color,
  weight: _weight,
  style,
  testID,
}: {
  name: AppIconName;
  size?: number;
  color?: string;
  /** Accepted for compatibility; vector glyphs render single-style. */
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const entry = iconMap[name];
  const fallback = iconDefaults[name];
  const Cmp = entry.set;
  return <Cmp name={entry.glyph} size={size} color={color ?? fallback.color} style={style} testID={testID} />;
}
