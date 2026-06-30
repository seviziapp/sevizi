const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// `react-native-maps` is native-only and has no web build. On web it must never
// be bundled — Metro statically follows every `require()` regardless of runtime
// Platform guards, and pulling it in drags react-native core internals into the
// web graph, which fails to resolve `react-native/Libraries/Utilities/Platform`.
// Redirect it to a harmless stub when bundling for web.
const mapsStub = path.resolve(__dirname, 'src/lib/react-native-maps-stub.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { type: 'sourceFile', filePath: mapsStub };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
