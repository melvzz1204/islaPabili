import { Image } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/islapabili_logo.png');

/**
 * IslaPabili brand mark from `apps/mobile/assets/islapabili_logo.png`.
 * Square badge — height follows width.
 */
type BrandLogoProps = {
  /** Rendered width/height in px. Defaults to 200. */
  width?: number;
  accessibilityLabel?: string;
};

export function BrandLogo({ width = 200, accessibilityLabel = 'IslaPabili logo' }: BrandLogoProps) {
  return (
    <Image
      source={LOGO}
      accessibilityLabel={accessibilityLabel}
      resizeMode="contain"
      style={{ width, height: width }}
    />
  );
}
