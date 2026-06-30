// Web stub for `react-native-maps` (a native-only library with no web build).
// Every usage in the app is guarded behind `Platform.OS !== 'web'`, so nothing
// here is ever rendered on web — this exists only so Metro has something to
// resolve for the static `require('react-native-maps')` calls when bundling web.
// Without it, Metro pulls react-native core internals into the web bundle and
// the build fails on `react-native/Libraries/Utilities/Platform`.

const Noop = () => null;

module.exports = {
  __esModule: true,
  default: Noop,
  Marker: Noop,
  Callout: Noop,
  Polyline: Noop,
  Polygon: Noop,
  Circle: Noop,
  Overlay: Noop,
  PROVIDER_GOOGLE: undefined,
  PROVIDER_DEFAULT: undefined,
};
