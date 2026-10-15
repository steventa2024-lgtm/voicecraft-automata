const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const protocol = path.resolve(__dirname, "../packages/protocol");
config.watchFolders = [...new Set([...(config.watchFolders || []), protocol])];

module.exports = config;
