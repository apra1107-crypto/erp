
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for socket.io-client
config.resolver.sourceExts.push('cjs');

module.exports = config;
