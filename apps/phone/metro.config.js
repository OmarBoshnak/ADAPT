const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);

// @adapt/* resolve through tsconfig paths; core's only dependency, zod, is hoisted to the root.
config.watchFolders = [
  path.join(root, 'packages/core'),
  path.join(root, 'packages/data/generated'),
  path.join(root, 'node_modules/zod'),
];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];

module.exports = config;
