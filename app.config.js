/**
 * Repo-root Expo config — EAS Build always runs from the directory containing
 * eas.json (the repo root), while the app lives in apps/mobile.
 *
 * This wrapper re-exports apps/mobile/app.json (the single source of truth)
 * and only rewrites asset paths to be root-relative. Local dev from
 * apps/mobile/ is untouched (it keeps using its own app.json).
 */
const mobile = require('./apps/mobile/app.json').expo;

const withRootAssets = (plugins) =>
  (plugins ?? []).map((entry) => {
    if (Array.isArray(entry) && entry[1] && typeof entry[1] === 'object') {
      const props = { ...entry[1] };
      // Rewrite mobile-relative asset paths to root-relative ones so EAS
      // Build (which runs from the repo root) can find them. Covers
      // expo-splash-screen (image) and expo-notifications (icon).
      for (const key of ['image', 'icon', 'foregroundImage']) {
        if (typeof props[key] === 'string' && props[key].startsWith('./assets/')) {
          props[key] = props[key].replace('./assets/', './apps/mobile/assets/');
        }
      }
      return [entry[0], props];
    }
    return entry;
  });

module.exports = {
  ...mobile,
  icon: './apps/mobile/assets/islapabili_logo.png',
  android: {
    ...mobile.android,
    adaptiveIcon: {
      ...mobile.android?.adaptiveIcon,
      foregroundImage: './apps/mobile/assets/adaptive-icon.png',
    },
  },
  web: {
    ...mobile.web,
    favicon: './apps/mobile/assets/islapabili_logo.png',
  },
  plugins: withRootAssets(mobile.plugins),
};
