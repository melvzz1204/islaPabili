import { SvgXml } from 'react-native-svg';

const LOGO_ASPECT = 680 / 420;

/**
 * IslaPabili brand lockup — badge + wordmark from
 * `apps/mobile/assets/islapabili_logo.svg`, inlined as XML so it renders
 * on native + web without an SVG transformer.
 */
export const ISLAPABILI_LOGO_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 420"><circle cx="340" cy="150" r="120" fill="#E8F6F3"/><defs><clipPath id="islaBadgeClip"><circle cx="340" cy="150" r="120"/></clipPath></defs><g clip-path="url(#islaBadgeClip)"><circle cx="340" cy="95" r="34" fill="#F4A340"/><path d="M220 190 Q 260 170 300 190 T 380 190 T 460 190 L460 270 L220 270 Z" fill="#2CA6A4"/><path d="M220 210 Q 260 192 300 210 T 380 210 T 460 210 L460 270 L220 270 Z" fill="#1F8F8D"/><path d="M340 220 L340 150" stroke="#6B4226" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M340 155 Q 300 130 285 145 Q 300 165 340 165 Z" fill="#2F8F4E"/><path d="M340 155 Q 380 128 396 144 Q 380 166 340 165 Z" fill="#37A35A"/><path d="M340 150 Q 320 110 335 92 Q 355 112 340 150 Z" fill="#2F8F4E"/><path d="M340 150 Q 362 116 350 96 Q 332 118 340 150 Z" fill="#37A35A"/><g transform="translate(410,175)"><path d="M-16 -6 L16 -6 L20 34 L-20 34 Z" fill="#F4A340" stroke="#C97F24" stroke-width="2"/><path d="M-9 -6 Q-9 -22 0 -22 Q9 -22 9 -6" fill="none" stroke="#C97F24" stroke-width="3" stroke-linecap="round"/></g></g><circle cx="340" cy="150" r="120" fill="none" stroke="#1F8F8D" stroke-width="3"/><text x="340" y="350" text-anchor="middle" font-size="48" font-weight="700" fill="#0B1220" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" letter-spacing="-1">islapabili</text><text x="340" y="382" text-anchor="middle" font-size="26" font-weight="600" fill="#7A8699" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" letter-spacing="2">island marketplace</text></svg>`;

type BrandLogoProps = {
  /** Rendered width in px. Height follows the 680x420 aspect. Defaults to 200. */
  width?: number;
  accessibilityLabel?: string;
};

export function BrandLogo({ width = 200, accessibilityLabel = 'IslaPabili logo' }: BrandLogoProps) {
  const height = width / LOGO_ASPECT;
  return <SvgXml xml={ISLAPABILI_LOGO_XML} width={width} height={height} accessibilityLabel={accessibilityLabel} />;
}
