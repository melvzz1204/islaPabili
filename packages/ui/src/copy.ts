/**
 * Brand voice copy (UI design.docx Table 2 + taglines).
 * Screens must use these constants instead of inventing ad-hoc strings,
 * keeping the hyper-local Taglish tone consistent.
 */
export const taglines = {
  primary: 'IslaPabili: Bili at Deliver sa Pintuan Mo.',
  alternative: 'Mga Kailangan Mo sa Isla, Ipabili Mo na!',
} as const;

export const brandCopy = {
  emptyCart: 'Wala pang laman ang cart mo. Ano\u2019ng ipapabili mo ngayong araw?',
  searchingRider:
    'Hina-hanap na namin ang pinakamalapit na Pabili Runner para sa\u2019yo...',
  orderPickedUp: 'Nabili na ni Rider ang order mo! Papunta na sa pinto niyo.',
  deliverySuccess: 'Salamat sa pag-Pabili! Naitawid na ang order mo.',
  riderOnboarding: 'Kumuha ng Biyahe, Kumita sa Isla. Mag-register bilang Rider!',
} as const;

export type BrandCopyKey = keyof typeof brandCopy;
