const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro 配置
 * 如需支持 svg/图片等可在此扩展
 */
const config = {
  resolver: {
    // @cosmjs/crypto 在 RN 上静态 require("crypto") 会失败，
    // 这里把 crypto 指向 react-native-get-random-values（无导出、仅注入 global.crypto.getRandomValues），
    // 使 cosmjs 回退到纯 JS 的 @noble/hashes 实现，同时提供随机数来源。
    extraNodeModules: {
      crypto: require.resolve('react-native-get-random-values'),
      buffer: require.resolve('buffer'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
