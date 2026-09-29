const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);

// @adapt/core resolves through tsconfig paths; its only dependency, zod, is hoisted to the root.
config.watchFolders = [path.join(root, 'packages/core'), path.join(root, 'node_modules/zod')];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];

module.exports = config;
