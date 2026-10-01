/**
 * Brand voice copy, mobile only.
 * How real users text: warm Taglish, short, walang arte.
 * Screens must use these constants instead of inventing ad-hoc strings.
 */
export const taglines = {
  primary: 'IslaPabili: Pabili na, hatid pa sa pinto mo.',
  alternative: 'Ano’ng kailangan mo sa isla? Ipabili mo na.',
} as const;

export const brandCopy = {
  emptyCart: 'Wala pa laman cart mo. Ano, papabili ka na ba?',
  searchingRider: 'Hanap lang kami ng malapit na rider, saglit lang…',
  orderPickedUp: 'Nabili na ni rider order mo! Otw na sa inyo.',
  deliverySuccess: 'Nakarating na! Salamat sa pagpabili.',
  riderOnboarding: 'Biyahe ka, kita ka. Apply bilang rider!',
  // Delivery-flow microcopy (onboarding → home → checkout → tracking)
  welcomePabiliTitle: 'Pabili mula sa paborito mong tindahan',
  welcomePabiliBody: 'Food, grocery, gamot. Order ka lang, kami na bahala bumili.',
  welcomeSwiftTitle: 'Mabilis na hatid',
  welcomeSwiftBody: 'Wala pang isang oras, nasa pinto mo na. O ikaw pumili ng oras.',
  welcomeTrackTitle: 'Kita mo bawat galaw',
  welcomeTrackBody: 'Makikita mo nasan na order mo, mula tindahan hanggang sa inyo.',
  homeGreeting: 'Ano’ng ipapabili mo ngayon?',
  searchHint: 'Anong cravings mo? Search ka lang…',
  cartNote: 'Delivery fee, sa checkout na icompute ha.',
  checkoutCta: 'Place order na',
  trackingActive: 'Otw na rider mo, abang-abang na.',
  orderHistoryEmpty: 'Wala ka pang order. Tara, umorder ka na?',
  profileTagline: 'Isang account lang, pang order at pang deliver.',
} as const;

export type BrandCopyKey = keyof typeof brandCopy;
