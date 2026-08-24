// Web stub for `@sentry/react-native`. Metro's web bundler cannot resolve the
// package's dual CJS/ESM exports field (fails on `@sentry/core`'s internal
// `./tracing/sentrySpan.js` require), so it's redirected here for web builds
// in metro.config.js — same pattern as the react-native-maps stub. Native
// (iOS/Android) builds use the real package untouched.

module.exports = {
  __esModule: true,
  init: () => {},
  wrap: (component) => component,
  captureException: () => {},
  captureMessage: () => {},
  setUser: () => {},
  addBreadcrumb: () => {},
};
