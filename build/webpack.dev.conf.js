'use strict'
const utils = require('./utils')
const webpack = require('webpack')
const config = require('../config')
const { webConfig } = require('../server/config/webConfig')
const { merge } = require('webpack-merge')
const path = require('path')
const baseWebpackConfig = require('./webpack.base.conf')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const portfinder = require('portfinder')

const devWebpackConfig = merge(baseWebpackConfig, {
  mode: 'development',
  module: {
    rules: utils.styleLoaders({
      sourceMap: config.dev.cssSourceMap,
      usePostCSS: true
    })
  },
  // cheap-module-eval-source-map is faster for development
  devtool: config.dev.devtool ? 'eval-cheap-module-source-map' : false,

  // these devServer options should be customized in /config/index.js
  devServer: {
    historyApiFallback: true,
    https: config.dev.https,
    compress: true,
    // disableHostCheck: true,
    host: config.dev.host,
    port: config.dev.port,
    open: config.dev.autoOpenBrowser,
    client: {
      logging: 'warn',
      overlay: config.dev.errorOverlay
        ? { warnings: false, errors: true }
        : false,
    },
    proxy: config.dev.proxyTable,
    static: {
      publicPath: config.dev.assetsPublicPath
    },
    watchFiles: {
      options:
      {
        usePolling: config.dev.poll
      }
    }
  },
  optimization: {
    emitOnErrors: true
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': require('../config/dev.env')
    }),
    new webpack.HotModuleReplacementPlugin(),
    // https://github.com/ampedandwired/html-webpack-plugin
    new HtmlWebpackPlugin({
      title: 'ZWave To MQTT',
      filename: 'index.html',
      template: 'views/index.ejs',
      templateParameters: {
        config: webConfig
      },
      inject: true
    }),
    // copy custom static assets
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, '../static'),
          to: config.dev.assetsSubDirectory,
          globOptions: {
            ignore: ['.*']
          }
        }
      ]
    })
  ]
})

module.exports = new Promise((resolve, reject) => {
  portfinder.basePort = process.env.PORT || config.dev.port
  portfinder.getPort((err, port) => {
    if (err) {
      reject(err)
    } else {
      // publish the new Port, necessary for e2e tests
      process.env.PORT = port
      // add port to devServer config
      devWebpackConfig.devServer.port = port

      resolve(devWebpackConfig)
    }
  })
})
