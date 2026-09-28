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
    if (Array.isArray(entry) && entry[0] === 'expo-splash-screen') {
      return [entry[0], { ...entry[1], image: './apps/mobile/assets/icon.png' }];
    }
    return entry;
  });

module.exports = {
  ...mobile,
  icon: './apps/mobile/assets/icon.png',
  android: {
    ...mobile.android,
    adaptiveIcon: {
      ...mobile.android?.adaptiveIcon,
      foregroundImage: './apps/mobile/assets/adaptive-icon.png',
    },
  },
  web: {
    ...mobile.web,
    favicon: './apps/mobile/assets/favicon.png',
  },
  plugins: withRootAssets(mobile.plugins),
};
