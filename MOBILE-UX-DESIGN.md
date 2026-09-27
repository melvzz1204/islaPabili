# IslaPabili Mobile — Premium UI/UX Design Spec

> **Scope:** Mobile app only (customer + rider). Merchant and admin are out of scope.
> **Platform:** React Native (Expo SDK 57), targeting low-to-mid-range Android devices.
> **Design language:** "Tropical Premium" — warm, trustworthy, island-inspired, fast.

---

## 1. Design Philosophy

### Core Principles

| Principle | Meaning |
|---|---|
| **Bilisan (Speed)** | Every interaction feels instant. Skeletons over spinners. Optimistic UI. |
| **Tiwala (Trust)** | Clear pricing, live status, transparent fares. No surprises. |
| **Bahay (Home)** | Warm, welcoming, familiar. Like a neighbor sari-sari store — not a warehouse. |
| **Isla (Island)** | Distinctly Marinduque. Teal waters, orange sunsets, green mountains. Not another faceless delivery app. |

### Brand Personality
- **Voice:** Taglish, warm, direct. "Bili at Deliver sa Pintuan Mo."
- **Tone:** Friendly but efficient. Never corporate.
- **Feeling:** Like texting a friend who runs errands for you — reliable, no fuss.

---

## 2. Design System

### 2.1 Color System

#### Brand Core
| Token | Hex | Usage |
|---|---|---|
| `primary` | `#0D9488` (Teal 600) | Primary actions, active states, links |
| `primary-dark` | `#0F766E` (Teal 700) | Pressed states, gradients end |
| `primary-soft` | `#CCFBF1` (Teal 100) | Tinted backgrounds, selected rows |
| `accent` | `#F97316` (Orange 500) | Pabili CTA, add-to-cart, FAB |
| `accent-dark` | `#EA580C` (Orange 600) | Pressed accent |
| `accent-soft` | `#FFF7ED` (Orange 50) | Accent tinted surfaces |
| `success` | `#059669` (Emerald 600) | Success states, delivered, wallet |
| `warning` | `#D97706` (Amber 600) | Pending, low stock |
| `danger` | `#DC2626` (Red 600) | Destructive, errors, out of stock |

#### Neutrals (Dark-First for OLED)
| Token | Hex | Usage |
|---|---|---|
| `bg` | `#F8FAFC` (Slate 50) | App background |
| `surface` | `#FFFFFF` | Cards, sheets, inputs |
| `surface-raised` | `#FFFFFF` | Modals, FABs |
| `ink` | `#0F172A` (Slate 900) | Primary text |
| `body` | `#334155` (Slate 700) | Secondary text |
| `muted` | `#64748B` (Slate 500) | Captions, placeholders |
| `faint` | `#94A3B8` (Slate 400) | Disabled, timestamps |
| `border` | `#E2E8F0` (Slate 200) | Dividers, input borders |
| `border-strong` | `#CBD5E1` (Slate 300) | Focused borders |

#### Semantic Gradients
```js
// Hero / Brand moments
gradient.sunset = ['#0D9488', '#14B8A6', '#F97316']  // Teal → Orange
gradient.ocean   = ['#0F766E', '#0D9488', '#2DD4BF']  // Deep teal
gradient.earth   = ['#F97316', '#FB923C', '#FDBA74']  // Warm orange
```

#### Category Colors (for merchant/product monograms)
| Category | Color | Hex |
|---|---|---|
| Restaurant | Warm Red | `#EF4444` |
| Grocery | Fresh Green | `#22C55E` |
| Pharmacy | Calm Blue | `#3B82F6` |
| Retail | Rich Purple | `#A855F7` |
| Electronics | Slate | `#64748B` |

### 2.2 Typography

**Primary Font:** Plus Jakarta Sans (display + body)
**Fallback:** System (-apple-system, Roboto, Inter)

| Scale | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `display` | 28px | Bold (700) | 34px | Screen headers, hero numbers |
| `title` | 22px | Bold (700) | 28px | Card titles, section headers |
| `heading` | 17px | SemiBold (600) | 22px | Sub-headers, button text |
| `body` | 15px | Regular (400) | 22px | Body copy, descriptions |
| `label` | 13px | Medium (500) | 18px | Labels, captions, badges |
| `caption` | 12px | Regular (400) | 16px | Timestamps, fine print |
| `micro` | 11px | Medium (500) | 14px | Tags, chips |

### 2.3 Spacing (4px grid)

| Token | Value | Usage |
|---|---|---|
| `xxs` | 2px | Icon-to-text gap |
| `xs` | 4px | Micro-adjustments |
| `sm` | 8px | Chip padding, badge gap |
| `md` | 12px | Input padding, card inner |
| `lg` | 16px | Screen padding, section gap |
| `xl` | 24px | Card gap, major section |
| `xxl` | 32px | Screen top/bottom |
| `xxxl` | 48px | Hero spacing |

### 2.4 Radius

| Token | Value | Usage |
|---|---|---|
| `sm` | 8px | Badges, chips |
| `md` | 12px | Inputs, small cards |
| `lg` | 16px | Cards, sheets |
| `xl` | 20px | Large cards, bottom sheets |
| `full` | 9999px | Pills, FABs, avatars |

### 2.5 Elevation & Shadows

```js
// Card — subtle, breathable
shadow.card = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 2,
}

// FAB / Floating — prominent but not heavy
shadow.fab = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 12,
  elevation: 8,
}

// Sheet / Modal — highest layer
shadow.sheet = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.12,
  shadowRadius: 20,
  elevation: 16,
}
```

### 2.6 Motion & Transitions

| Interaction | Duration | Easing |
|---|---|---|
| Button press | 100ms | ease-out |
| Sheet slide up | 300ms | cubic-bezier(0.32, 0.72, 0, 1) |
| Sheet slide down (dismiss) | 250ms | ease-in |
| Screen transition | 300ms | default (native stack) |
| Skeleton pulse | 1200ms | ease-in-out (infinite) |
| Badge/count update | 200ms | spring(1, 100, 10) |
| Cart item add | 250ms | spring(1, 80, 8) |
| Page turn (tab switch) | 200ms | ease-in-out |

---

## 3. Component Specs

### 3.1 Button

| Property | Value |
|---|---|
| Height | 48px (touch target) |
| Radius | 14px |
| Font | heading (17px, SemiBold) |
| Padding H | 20px |

**Variants:**

| Variant | BG | Text | Border | Pressed |
|---|---|---|---|---|
| `primary` | `primary` | `#FFFFFF` | none | `primary-dark`, scale 0.98 |
| `accent` | `accent` | `#FFFFFF` | none | `accent-dark`, scale 0.98 |
| `secondary` | `primary-soft` | `primary` | 1px `primary` | `primary-soft` darken 5% |
| `ghost` | transparent | `primary` | none | `primary-soft` |
| `danger` | `danger` | `#FFFFFF` | none | `#B91C1C` |

**States:** default → pressed (scale 0.98 + darken) → disabled (opacity 0.5) → loading (spinner + label)

**Icon support:** Left icon (20px), 8px gap from label.

---

### 3.2 Card

| Property | Value |
|---|---|
| BG | `surface` |
| Radius | `lg` (16px) |
| Padding | `lg` (16px) |
| Shadow | `card` |
| Gap between stacked cards | `lg` (16px) |

**Variants:**
- **Default:** White card, subtle shadow
- **Tinted:** `primary-soft` bg, no shadow
- **Outlined:** 1px `border` border, no shadow
- **Interactive:** Same as default + pressed scale 0.99 + shadow increase

---

### 3.3 TextField

| Property | Value |
|---|---|
| Height | 52px |
| Radius | `md` (12px) |
| BG | `surface` |
| Border | 1px `border` → focused: 2px `primary` |
| Padding H | `lg` (16px) |
| Label | Above field, `label` style, 4px gap |
| Helper text | Below field, `caption`, `muted` |
| Error state | Border `danger`, helper text `danger` |

**Left accessory:** Icon (20px), 12px gap from input.
**Right accessory:** Clear button (X), password toggle, or unit label.

---

### 3.4 Badge / Chip

| Property | Value |
|---|---|
| Height | 24px |
| Padding H | 10px |
| Radius | `sm` (8px) |
| Font | `micro` (11px, Medium) |

**Status variants:**

| Status | BG | Text |
|---|---|---|
| `success` | `#D1FAE5` | `#065F46` |
| `warning` | `#FEF3C7` | `#92400E` |
| `danger` | `#FEE2E2` | `#991B1B` |
| `info` | `#CCFBF1` | `#115E59` |
| `neutral` | `#F1F5F9` | `#475569` |
| `accent` | `#FFF7ED` | `#9A3412` |

---

### 3.5 Bottom Sheet

| Property | Value |
|---|---|
| Radius top | `xl` (24px) |
| BG | `surface` |
| Handle | 36×4px, `border` color, centered, 12px top |
| Max height | 90% screen |
| Animation | Slide up 300ms, spring dismiss |

**Structure:**
```
[Handle]
[Title + Close button]
[Subtitle / meta]
[--- Content scroll area ---]
[Footer: CTA buttons]
```

---

### 3.6 FAB (Floating Action Button — Cart)

| Property | Value |
|---|---|
| Height | 56px |
| Radius | `full` |
| BG | `ink` (#0F172A) |
| Text | `#FFFFFF`, heading |
| Shadow | `fab` |
| Position | Bottom 20px, centered, max-width (screen - 32px) |

**Content:** Cart icon + "{count} items · {subtotal}"

**Animation:** Scale in spring on first item add. Slide up on screen enter.

---

### 3.7 Product Card

| Property | Value |
|---|---|
| Layout | Horizontal: image (88×88) → info → actions |
| Radius | `lg` (16px) |
| Image radius | `md` (12px) |
| Padding | `md` (12px) |

**Structure:**
```
┌─────────────────────────────────────────┐
│ [IMG 88×88]  Product Name          [+]  │
│              Description...             │
│              [Stock Badge]              │
│              ₱250.00 / piece            │
└─────────────────────────────────────────┘
```

**States:** Default → Pressed (scale 0.98) → Added (shows QtyStepper)

---

### 3.8 Merchant Card

| Property | Value |
|---|---|
| Layout | Horizontal: monogram (56×56) → info |
| Radius | `lg` (16px) |
| Padding | `md` (12px) |

**Structure:**
```
┌─────────────────────────────────────────┐
│ [M]  Merchant Name          [Category]  │
│      Tagline text                       │
│      [Town]                             │
└─────────────────────────────────────────┘
```

---

### 3.9 Skeleton

| Property | Value |
|---|---|
| BG | `#E2E8F0` (Slate 200) |
| Shimmer | Gradient sweep 1200ms infinite |
| Radius | Match component being skeleton'd |

**Skeleton screens:** Match exact layout of loaded content. No generic rectangles.

---

### 3.10 Toast

| Property | Value |
|---|---|
| BG | `#0F172A` (95% opacity) |
| Text | `#FFFFFF` |
| Radius | `md` (12px) |
| Padding | 12px 16px |
| Position | Top 48px (below status bar), centered |
| Duration | 2.5s auto-dismiss |
| Animation | Slide down + fade |

**Variants:** Success (emerald icon), Error (red icon), Info (teal icon)

---

### 3.11 Empty State

| Property | Value |
|---|---|
| Icon | 64px, `faint` color |
| Title | `heading` |
| Message | `caption`, `muted` |
| Action | Optional CTA button |

**Centered vertically** in available space.

---

### 3.12 Order Timeline

| Property | Value |
|---|---|
| Line | 2px `border`, vertical |
| Dot | 12px circle, filled for completed, outline for pending |
| Active dot | `accent` color + pulse ring |
| Label | `body` |
| Timestamp | `caption`, `faint` |

---

### 3.13 Tab Bar (Bottom)

| Property | Value |
|---|---|
| Height | 64px + safe area |
| BG | `surface` |
| Border | Top 1px `border` |
| Active icon | `primary`, label `primary` |
| Inactive icon | `faint`, label `faint` |
| Badge | Red dot for notifications |

---

### 3.14 Quantity Stepper

| Property | Value |
|---|---|
| Button size | 32×32 (compact) or 40×40 (full) |
| Radius | 10px |
| BG | `primary` (filled) or `surface` with border |
| Icon | Plus/Minus, 18px |
| Count | Min-width 28px, centered, `heading` |

---

### 3.15 Radio / Selector Card

| Property | Value |
|---|---|
| Layout | Horizontal: radio circle → label + sublabel |
| Radius | `md` (12px) |
| Border | 1px `border` → selected: 2px `primary` |
| BG | `surface` → selected: `primary-soft` |
| Radio | 20px circle, border 2px, filled when selected |

---

### 3.16 Search Bar

| Property | Value |
|---|---|
| Height | 48px |
| Rad | `full` (pill) |
| BG | `surface` |
| Border | 1px `border` |
| Icon | Search, 20px, `muted` |
| Placeholder | `body`, `muted` |
| Clear | X button when has text |

---

## 4. Screen-by-Screen Design

### 4.1 Auth Home (Landing)

```
┌─────────────────────────────┐
│                             │
│      ╭───────────╮          │
│      │  ISLA     │  ← Logo  │
│      │  PABILI   │    mark  │
│      ╰───────────╯          │
│                             │
│   Bili at Deliver sa        │
│   Pintuan Mo                │
│                             │
│   Browse Marinduque         │
│   stores, order pabili,     │
│   get it delivered.         │
│                             │
│  ┌───────────────────────┐  │
│  │  Continue with Google │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  Continue with Apple  │  │
│  └───────────────────────┘  │
│                             │
│  ────────── or ──────────   │
│                             │
│  ┌───────────────────────┐  │
│  │  Log in               │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  Create an account    │  │
│  └───────────────────────┘  │
│                             │
│  Continue browsing stores → │
│                             │
└─────────────────────────────┘
```

**Interactions:**
- Logo fades in + scales from 0.9
- Buttons stagger in (50ms each)
- "Continue browsing" at bottom for guest mode

---

### 4.2 Login

```
┌─────────────────────────────┐
│  ← Back                     │
│                             │
│  Welcome back               │
│  Mag-order pabili anywhere  │
│  in Marinduque              │
│                             │
│  Username or email          │
│  ┌───────────────────────┐  │
│  │ 👤 juan_dela_cruz     │  │
│  └───────────────────────┘  │
│                             │
│  Password                   │
│  ┌───────────────────────┐  │
│  │ 🔒 ••••••••    👁️    │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  Log in               │  │
│  └───────────────────────┘  │
│                             │
│  ────── New here? ──────    │
│                             │
│  Create an account →        │
│  Continue with phone →      │
│                             │
└─────────────────────────────┘
```

**Interactions:**
- Auto-focus username field
- Password toggle (eye icon)
- Error shake animation on failed login
- "Resend confirmation" appears only when needed

---

### 4.3 Register

```
┌─────────────────────────────┐
│  ← Back                     │
│                             │
│  Create your account        │
│  2 steps: profile → phone   │
│                             │
│  ●──────○                    │
│  Profile    Phone            │
│                             │
│  Full name                  │
│  ┌───────────────────────┐  │
│  │ Juan Dela Cruz        │  │
│  └───────────────────────┘  │
│                             │
│  Username                   │
│  ┌───────────────────────┐  │
│  │ juan_dela_cruz        │  │
│  └───────────────────────┘  │
│  ✓ Available               │
│                             │
│  Email                      │
│  ┌───────────────────────┐  │
│  │ juan@email.com        │  │
│  └───────────────────────┘  │
│                             │
│  Password                   │
│  ┌───────────────────────┐  │
│  │ ••••••••••    👁️     │  │
│  └───────────────────────┘  │
│  ░░░░░░░░░░░░░░░░░░░░░░░  │
│  Password strength: Medium  │
│                             │
│  ┌───────────────────────┐  │
│  │  Continue             │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

**Interactions:**
- Step indicator (progress dots)
- Real-time username availability check
- Password strength meter
- Auto-advance to next field

---

### 4.4 Home (Main Hub)

```
┌─────────────────────────────┐
│  📍 Boac          🔔  👤    │
│                             │
│  Kamusta, Juan!             │
│                             │
│  ┌─────────────────────────┐│
│  │  [ICON] Order Pabili    ││
│  │  Browse local stores... ││
│  │  [Browse marketplace →] ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │  [ICON] My Orders       ││
│  │  Track live status...   ││
│  │  [View orders →]        ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │  [ICON] Drive & Earn    ││
│  │  Become a rider...      ││
│  │  [Apply now →]          ││
│  └─────────────────────────┘│
│                             │
│  ┌────┬────┬────┬────┐     │
│  │Home │Shop │Cart │More│     │
│  └────┴────┴────┴────┘     │
└─────────────────────────────┘
```

**Interactions:**
- Pull-to-refresh on order cards
- Badge on Orders card if active order exists
- Bottom tab bar with 4 tabs

---

### 4.5 Market (Browse Stores)

```
┌─────────────────────────────┐
│  IslaPabili       🔔  👤    │
│                             │
│  ┌─────────────────────────┐│
│  │ 🔍 Search stores...      ││
│  └─────────────────────────┘│
│                             │
│  [All][Food][Grocery][More] │
│                             │
│  ┌─────────────────────────┐│
│  │ [J] Jollibee Boac       ││
│  │     Masarap na delivered ││
│  │     [Fast Food] [Boac]  ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ [G] Gaisano Grand       ││
│  │     Your daily grocery.. ││
│  │     [Grocery] [Boac]    ││
│  └─────────────────────────┘│
│                             │
│  ┌────┬────┬────┬────┐     │
│  │Home │Shop │Cart │More│     │
│  └────┴────┴────┴────┘     │
└─────────────────────────────┘
```

**Interactions:**
- Sticky search bar (shrinks on scroll)
- Horizontal scrollable category chips
- Skeleton cards while loading
- Pull-to-refresh

---

### 4.6 Store (Product Listing)

```
┌─────────────────────────────┐
│  ← Back           [Share]   │
│                             │
│  ┌─────────────────────────┐│
│  │ [J]                     ││
│  │ Jollibee Boac           ││
│  │ Masarap na delivered    ││
│  │ ⭐ 4.8 · Fast Food · Boac│
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ 🔍 Search products...    ││
│  └─────────────────────────┘│
│                             │
│  [All][Chicken][Drinks]...  │
│                             │
│  Sort: Popular ▼            │
│                             │
│  ┌─────────────────────────┐│
│  │ [IMG] Chickenjoy    [+] ││
│  │        8pc bucket       ││
│  │        ₱450.00         ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ [IMG] Jolly Spaghetti   ││
│  │        ₱55.00      [+]  ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ 🛒 3 items · ₱560.00 →  ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

**Interactions:**
- Parallax header (merchant info shrinks on scroll)
- Category chips + sort dropdown
- Tap product → bottom sheet detail
- "Add" button morphs to QtyStepper
- FAB shows cart total

---

### 4.7 Product Detail (Bottom Sheet)

```
┌─────────────────────────────┐
│  ─────── (handle)           │
│                             │
│  ┌─────────────────────────┐│
│  │ [IMG 120×120]           ││
│  │                         ││
│  │ Chickenjoy 8pc          ││
│  │ ₱450.00 / bucket        ││
│  │ [In Stock]              ││
│  └─────────────────────────┘│
│                             │
│  Crispy fried chicken       │
│  with gravy and rice.       │
│                             │
│  ┌─────────────────────────┐│
│  │  −  1  +    Add to cart  ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

**Interactions:**
- Slide up from bottom
- Image zoom on tap
- Quantity stepper
- "Add to cart" button with price

---

### 4.8 Cart

```
┌─────────────────────────────┐
│  ← Back                     │
│                             │
│  Your cart (3)         Clear│
│                             │
│  ┌─────────────────────────┐│
│  │ Jollibee Boac           ││
│  │ ─────────────────────── ││
│  │ [IMG] Chickenjoy  8pc   ││
│  │        ₱450.00    [− 1 +]│
│  │        [Remove]         ││
│  │ ─────────────────────── ││
│  │ [IMG] Jolly Spaghetti   ││
│  │        ₱55.00     [− 1 +]│
│  │        [Remove]         ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ Items: 3                ││
│  │ Subtotal: ₱560.00       ││
│  │ Delivery: calculated    ││
│  │                         ││
│  │ ┌─────────────────────┐ ││
│  │ │ Checkout ₱560.00 →  │ ││
│  │ └─────────────────────┘ ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

**Interactions:**
- Swipe to delete (alternative to Remove button)
- Quantity stepper inline
- Grouped by merchant
- Sticky checkout summary at bottom

---

### 4.9 Checkout

```
┌─────────────────────────────┐
│  ← Back                     │
│                             │
│  Checkout (3 items)         │
│                             │
│  ┌─────────────────────────┐│
│  │ How do you want it?     ││
│  │ ● Rider delivery ₱40    ││
│  │ ○ Pick up myself (Free) ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ Order summary (3)       ││
│  │ 2× Chickenjoy  ₱900.00  ││
│  │ 1× Spaghetti   ₱55.00   ││
│  │ ─────────────────────── ││
│  │ Subtotal       ₱955.00  ││
│  │ Delivery       ₱40.00   ││
│  │ ─────────────────────── ││
│  │ Total          ₱995.00  ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ Delivery details        ││
│  │ Name: Juan Dela Cruz    ││
│  │ Phone: 09XX XXX XXXX    ││
│  │ Town: Boac ▼            ││
│  │ Address: Brgy. ...      ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ Payment                 ││
│  │ ● Cash on Delivery      ││
│  │ ○ GCash                 ││
│  │ ○ Maya                  ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │  Place order ₱995.00 →  ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

**Interactions:**
- Delivery/Pickup as selectable cards (radio style)
- Payment method as radio cards
- Sticky "Place order" CTA at bottom
- Success animation → order number

---

### 4.10 Order Success

```
┌─────────────────────────────┐
│                             │
│                             │
│         ╭───────╮           │
│         │   ✓   │  ← Green  │
│         ╰───────╯    circle │
│                             │
│    Order sent to store!     │
│                             │
│    Order #: ISL-2024-001    │
│                             │
│    The store will prepare   │
│    your order and a rider   │
│    will deliver it to you.  │
│                             │
│  ┌─────────────────────────┐│
│  │  Track my orders →      ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │  Back to marketplace     ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

**Interactions:**
- Confetti or checkmark draw animation
- Order number prominently displayed
- Haptic feedback on appearance

---

### 4.11 Orders List

```
┌─────────────────────────────┐
│  ← Back                     │
│                             │
│  My orders (5)              │
│                             │
│  ┌─────────────────────────┐│
│  │ ISL-2024-001     [Preparing]│
│  │ Rider delivery · ₱995   ││
│  │ 2 min ago               ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ ISL-2024-002     [On its way]│
│  │ Rider delivery · ₱250   ││
│  │ 1 hour ago              ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ ISL-2024-003     [Completed]│
│  │ Self-pickup · ₱120      ││
│  │ Yesterday               ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

**Interactions:**
- Pull-to-refresh
- Realtime updates (badge changes, new orders slide in)
- Tap → order detail sheet
- Swipe left for quick cancel (on cancellable orders)

---

### 4.12 Order Detail (Bottom Sheet)

```
┌─────────────────────────────┐
│  ─────── (handle)           │
│                             │
│  Order ISL-2024-001    [×] │
│  Being prepared             │
│                             │
│  ┌─────────────────────────┐│
│  │ ● Order placed          ││
│  │ │ 2:30 PM               ││
│  │ ● Being prepared        ││
│  │ │ 2:35 PM  ← (active)   ││
│  │ ○ Ready for pickup      ││
│  │ ○ On its way            ││
│  │ ○ Delivered             ││
│  └─────────────────────────┘│
│                             │
│  Items (3)                  │
│  2× Chickenjoy    ₱900.00  │
│  1× Jolly Spaghetti ₱55.00 │
│                             │
│  ┌─────────────────────────┐│
│  │ Cancel order            ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

---

### 4.13 Notifications

```
┌─────────────────────────────┐
│  ← Back                     │
│                             │
│  Notifications        Mark  │
│                       all  │
│                             │
│  ┌─────────────────────────┐│
│  │ 🛵 Your order is on its ││
│  │    way! Rider Jomar is  ││
│  │    5 min away.          ││
│  │    2 min ago     [New]  ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ 📦 Order ISL-2024-001   ││
│  │    is being prepared.   ││
│  │    30 min ago           ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ 🎉 Welcome to IslaPabili!││
│  │    Get ₱50 off your     ││
│  │    first order.         ││
│  │    Yesterday            ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

---

### 4.14 Rider Home

```
┌─────────────────────────────┐
│                             │
│  📍 Boac                    │
│                             │
│  ┌─────────────────────────┐│
│  │  ● ON DUTY              ││
│  │  ─────────────────────  ││
│  │  Today's earnings       ││
│  │  ₱350.00                ││
│  │  5 deliveries           ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │  Available orders (3)   ││
│  │                         ││
│  │  ┌───────────────────┐  ││
│  │  │ Jollibee → Boac   │  ││
│  │  │ 2.3 km · ₱45      │  ││
│  │  │ [Accept] [Decline]│  ││
│  │  └───────────────────┘  ││
│  │                         ││
│  │  ┌───────────────────┐  ││
│  │  │ Mercury → Gasan   │  ││
│  │  │ 5.1 km · ₱65      │  ││
│  │  │ [Accept] [Decline]│  ││
│  │  └───────────────────┘  ││
│  └─────────────────────────┘│
│                             │
│  ┌────┬────┬────┬────┐     │
│  │Home │Orders│Earnings│Profile│
│  └────┴────┴────┴────┘     │
└─────────────────────────────┘
```

---

## 5. Navigation Structure

### Bottom Tab Bar (Customer)
| Tab | Icon | Label |
|---|---|---|
| Home | `home` | Home |
| Shop | `shop` | Shop |
| Cart | `cart` | Cart (badge with count) |
| Profile | `profile` | Profile |

### Bottom Tab Bar (Rider)
| Tab | Icon | Label |
|---|---|---|
| Home | `home` | Home |
| Orders | `orders` | Orders |
| Earnings | `wallet` | Earnings |
| Profile | `profile` | Profile |

### Stack Navigation
```
AuthStack:
  AuthHome → Login → Register → Phone

MainStack:
  Home
  Market → Store → ProductSheet
  Cart → Checkout → OrderSuccess
  Orders → OrderDetailSheet
  Notifications
  Rider → RiderApplication → RiderStatus → RiderHome
  Profile → EditProfile → Settings
```

---

## 6. Micro-Interactions

### Button Press
- Scale: 0.98
- Duration: 100ms
- Easing: ease-out

### Card Tap
- Scale: 0.99
- Shadow: increase slightly
- Duration: 150ms

### Add to Cart
- Button morphs to QtyStepper (width animation)
- Cart badge bounces (spring)
- FAB slides up with count

### Sheet Dismiss
- Drag down: follows finger
- Release: spring to dismissed position
- Backdrop fades

### Pull to Refresh
- Custom refresh indicator with logo
- Threshold: 80px
- Haptic on trigger

### Skeleton Pulse
- Opacity: 0.5 → 1 → 0.5
- Duration: 1200ms
- Easing: ease-in-out

### Toast Enter
- Slide down from top + fade in
- Duration: 300ms
- Spring: damping 15

### Toast Exit
- Fade out + slide up
- Duration: 200ms

---

## 7. Loading States

### Skeleton Screens
Every list view has a skeleton that matches the loaded layout:

**Market Skeleton:**
```
[Search bar skeleton]
[Chip skeletons × 5]
[Merchant card skeleton × 3]
```

**Store Skeleton:**
```
[Search bar skeleton]
[Chip skeletons × 4]
[Product card skeleton × 4]
```

**Orders Skeleton:**
```
[Order card skeleton × 3]
```

### Inline Loading
- Button: spinner replaces label
- Pull-to-refresh: custom indicator
- Tab switch: instant (no loading)

### Optimistic UI
- Add to cart: instant, rollback on failure
- Cancel order: instant, confirm with toast
- Login: optimistic, redirect on success

---

## 8. Error States

### Network Error
```
┌─────────────────────────────┐
│                             │
│         ╭───────╮           │
│         │   ⚠️   │           │
│         ╰───────╯           │
│                             │
│    No internet connection   │
│                             │
│    Check your connection    │
│    and try again.           │
│                             │
│  ┌─────────────────────────┐│
│  │  Retry                  ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

### Empty States
Each screen has a contextual empty state:

| Screen | Icon | Title | Message | CTA |
|---|---|---|---|---|
| Cart | cart | "Your cart is empty" | "Add something tasty from local stores." | "Browse stores" |
| Orders | orders | "No orders yet" | "Your orders will appear here with live tracking." | "Browse stores" |
| Notifications | bell | "All caught up!" | "No new notifications." | — |
| Search | search | "No results found" | "Try a different search term." | — |

---

## 9. Accessibility

### Touch Targets
- Minimum: 44×44px (Apple HIG) / 48×48px (Material)
- Spacing between targets: 8px minimum

### Color Contrast
- Body text: 7:1 ratio (WCAG AAA)
- Large text: 4.5:1 ratio
- Interactive elements: 3:1 ratio

### Screen Readers
- All icons have `accessibilityLabel`
- Decorative icons: `accessibilityHidden`
- State changes announced via `accessibilityLiveRegion`

### Dynamic Type
- Support system font scaling up to 150%
- Layout adapts (no fixed heights for text containers)

### Reduced Motion
- Disable parallax and non-essential animations
- Respect `AccessibilityInfo.isReduceMotionEnabled()`

---

## 10. Performance

### Targets
| Metric | Target |
|---|---|
| Time to Interactive | < 2s |
| First Contentful Paint | < 1s |
| Input latency | < 100ms |
| Frame rate | 60fps (no jank) |
| Bundle size | < 10MB (initial) |

### Optimizations
- Image: WebP format, lazy loading, blur placeholder
- List: FlatList with `getItemLayout`, `keyExtractor`, `removeClippedSubviews`
- Navigation: Lazy screen mounting
- State: Minimal re-renders with `React.memo`, `useMemo`, `useCallback`
- Network: Request deduplication, cache-first for product data

---

## 11. Dark Mode (Future)

Token mapping for dark mode:

| Light Token | Dark Token | Value |
|---|---|---|
| `bg` | `bg` | `#0F172A` (Slate 900) |
| `surface` | `surface` | `#1E293B` (Slate 800) |
| `ink` | `ink` | `#F8FAFC` (Slate 50) |
| `body` | `body` | `#CBD5E1` (Slate 300) |
| `muted` | `muted` | `#94A3B8` (Slate 400) |
| `border` | `border` | `#334155` (Slate 700) |

---

## 12. Implementation Notes

### File Structure (Mobile)
```
src/
  screens/
    auth/
      AuthHomeScreen.tsx
      LoginScreen.tsx
      RegisterScreen.tsx
      PhoneScreen.tsx
    HomeScreen.tsx
    MarketScreen.tsx
    StoreScreen.tsx
    CartScreen.tsx
    CheckoutScreen.tsx
    OrdersScreen.tsx
    NotificationsScreen.tsx
    ProfileScreen.tsx
    rider/
      RiderGateScreen.tsx
      RiderApplicationScreen.tsx
      RiderStatusScreen.tsx
      RiderHomeScreen.tsx
  marketplace/
    data.ts
    cart.tsx
    components.tsx
  ui/
    Button.tsx
    TextField.tsx
    Screen.tsx
    TownPicker.tsx
    Toast.tsx
  components/
    SocialAuth.tsx
    TermsAndConditions.tsx
    Skeleton.tsx
    EmptyState.tsx
  lib/
    supabase.ts
    checkoutReturn.ts
    useResendCooldown.ts
  navigation/
    types.ts
    AppNavigator.tsx
```

### Priority Order (Implementation)
1. Design tokens update (colors, typography, spacing)
2. Core components (Button, Card, TextField, Badge)
3. Skeleton + Empty states
4. Auth screens (Login, Register)
5. Market + Store screens
6. Cart + Checkout
7. Orders + Order detail
8. Micro-interactions + polish
9. Performance optimization
10. Accessibility audit

---

*End of spec.*
