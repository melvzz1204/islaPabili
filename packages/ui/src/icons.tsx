import type { ComponentProps } from 'react';
import {
  ArrowLeft,
  Bank,
  Bell,
  Buildings,
  Camera,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  Coffee,
  CreditCard,
  Envelope,
  Eye,
  EyeSlash,
  FacebookLogo,
  Fire,
  FirstAid,
  ForkKnife,
  FunnelSimple,
  Gear,
  Gift,
  GoogleLogo,
  Heart,
  Headset,
  House,
  ImageSquare,
  Info,
  List,
  Lock,
  MagnifyingGlass,
  MapPin,
  Minus,
  Motorcycle,
  NavigationArrow,
  Package,
  PencilSimple,
  Phone,
  PhoneCall,
  PlusCircle,
  Receipt,
  Scooter,
  SealCheck,
  ShieldCheck,
  SignOut,
  ShoppingBagOpen,
  ShoppingCart,
  Sparkle,
  Star,
  Storefront,
  Tag,
  Timer,
  TrendUp,
  Trash,
  Truck,
  User,
  Users,
  Wallet,
  Warning,
  X,
} from 'phosphor-react-native';
import { colors } from './tokens';

/**
 * Centralized Phosphor icon mapping.
 * Screens reference `AppIcon` names — never import Phosphor directly — so
 * icon style/weight/color changes propagate from here.
 */
export const iconMap = {
  // Navigation
  home: House,
  shop: Storefront,
  storefront: Storefront,
  cart: ShoppingCart,
  orders: Receipt,
  receipt: Receipt,
  user: User,
  profile: User,

  // Documents
  camera: Camera,
  image: ImageSquare,

  // Commerce
  pabili: ShoppingBagOpen,
  package: Package,
  tag: Tag,
  gift: Gift,
  heart: Heart,
  rating: Star,
  add: PlusCircle,
  minus: Minus,
  close: X,
  trash: Trash,
  edit: PencilSimple,
  verified: SealCheck,

  // Categories
  categoryPharmacy: FirstAid,
  categoryFood: ForkKnife,
  categoryCoffee: Coffee,
  categoryGrocery: Buildings,
  categoryRetail: ShoppingBagOpen,
  categoryDelivery: Truck,

  // Actions
  search: MagnifyingGlass,
  filter: FunnelSimple,
  check: Check,
  checkCircle: CheckCircle,
  chevronRight: CaretRight,
  chevronLeft: CaretLeft,
  chevronDown: CaretDown,
  back: ArrowLeft,
  list: List,
  settings: Gear,
  support: Headset,

  // Rider / delivery
  rider: Motorcycle,
  scooter: Scooter,
  route: NavigationArrow,
  earnings: TrendUp,
  wallet: Wallet,
  bank: Bank,
  pay: CreditCard,
  users: Users,

  // Status / meta
  clock: Clock,
  timer: Timer,
  trending: Fire,
  warning: Warning,
  info: Info,
  shield: ShieldCheck,
  spark: Sparkle,
  logout: SignOut,
  pin: MapPin,
  call: PhoneCall,
  bell: Bell,

  // Account
  lock: Lock,
  eye: Eye,
  eyeOff: EyeSlash,
  email: Envelope,
  phone: Phone,
  google: GoogleLogo,
  facebook: FacebookLogo,
} as const;

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

type PhosphorProps = ComponentProps<typeof House>;

export function AppIcon({
  name,
  size = 24,
  color,
  weight,
  ...rest
}: {
  name: AppIconName;
  size?: number;
  color?: string;
  weight?: PhosphorProps['weight'];
} & Omit<PhosphorProps, 'size' | 'color' | 'weight'>) {
  const Cmp = iconMap[name];
  const fallback = iconDefaults[name];
  const resolvedWeight =
    weight ?? (fallback.style === 'fill' ? 'fill' : fallback.style === 'duotone' ? 'duotone' : 'regular');
  return <Cmp size={size} color={color ?? fallback.color} weight={resolvedWeight} {...rest} />;
}
