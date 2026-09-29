const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const root = path.resolve(__dirname, '../..');
const src = path.join(__dirname, 'src');
const defaults = getDefaultConfig(__dirname);

// The default resolver redirects `react-native` to the Vega platform package; chain onto it.
const platformResolve = defaults.resolver.resolveRequest;

module.exports = mergeConfig(defaults, {
  watchFolders: [
    path.join(root, 'packages/core'),
    path.join(root, 'packages/data'),
    path.join(root, 'node_modules/zod'),
  ],
  resolver: {
    nodeModulesPaths: [path.join(__dirname, 'node_modules')],
    extraNodeModules: {
      '@adapt/core': path.join(root, 'packages/core'),
      '@adapt/data': path.join(root, 'packages/data'),
    },
    resolveRequest: (context, moduleName, platform) => {
      const name = moduleName.startsWith('~/') ? path.join(src, moduleName.slice(2)) : moduleName;
      return (platformResolve ?? context.resolveRequest)(context, name, platform);
    },
  },
});
