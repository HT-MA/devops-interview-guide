// 自定义 webpack 配置，修复 ProgressPlugin 兼容性问题
const path = require('path');

module.exports = function (context, options) {
  return {
    name: 'custom-webpack-config',
    configureWebpack(config, isServer, utils) {
      // 移除有问题的 ProgressPlugin
      config.plugins = config.plugins.filter(
        plugin => plugin.constructor.name !== 'ProgressPlugin'
      );
      return config;
    },
  };
};
