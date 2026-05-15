// 自定义 webpack 配置，修复 ProgressPlugin 兼容性问题
// webpackbar 的 WebpackBarPlugin 继承 ProgressPlugin 后覆盖 this.options，
// 传入 name/color/reporters 等无效属性，webpack 5.106+ 校验失败
//
// 策略：在 configureWebpack 中直接修改 config.plugins（引用传递），
// 不返回完整 config 以避免 webpack-merge 的 array concat 导致重复

const webpack = require("webpack");

module.exports = function (context, options) {
  return {
    name: "custom-webpack-config",
    configureWebpack(config, isServer, utils) {
      // 直接修改原始数组，不返回 plugins 字段
      // （返回完整 config 会被 webpack-merge concat，导致重复）
      const originalPlugins = config.plugins;
      config.plugins = originalPlugins.filter(
        (plugin) => !(plugin instanceof webpack.ProgressPlugin)
      );

      // 返回空——改动已经通过引用传递直接生效
      return {};
    },
  };
};
