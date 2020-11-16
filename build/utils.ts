'use strict'
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'config'.
const config = require('../config')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'MiniCssExt... Remove this comment to see the full error message
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
// @ts-expect-error ts-migrate(2451) FIXME: Cannot redeclare block-scoped variable 'packageCon... Remove this comment to see the full error message
const packageConfig = require('../package.json')

exports.assetsPath = function (_path: any) {
  const assetsSubDirectory =
    process.env.NODE_ENV === 'production'
      ? config.build.assetsSubDirectory
      : config.dev.assetsSubDirectory

  return path.posix.join(assetsSubDirectory, _path)
}

exports.cssLoaders = function (options: any) {
  options = options || {}

  const cssLoader = {
    loader: 'css-loader',
    options: {
      sourceMap: options.sourceMap,
      esModule: false
    }
  }

  const postcssLoader = {
    loader: 'postcss-loader',
    options: {
      sourceMap: options.sourceMap
    }
  }

  // generate loader string to be used with extract text plugin
  function generateLoaders (loader: any, loaderOptions: any) {
    const loaders = options.usePostCSS
      ? [cssLoader, postcssLoader]
      : [cssLoader]

    if (loader) {
      loaders.push({
        loader: loader + '-loader',
        options: Object.assign({}, loaderOptions, {
          sourceMap: options.sourceMap
        })
      })
    }

    // Extract CSS when that option is specified
    // (which is the case during production build)
    if (options.extract) {
      return [
        {
          loader: MiniCssExtractPlugin.loader
        },
        'css-loader'
      ]
    } else {
      // @ts-expect-error ts-migrate(2769) FIXME: No overload matches this call.
      return ['vue-style-loader'].concat(loaders)
    }
  }

  // https://vue-loader.vuejs.org/en/configurations/extract-css.html
  return {
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 0.
    css: generateLoaders(),
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 0.
    postcss: generateLoaders(),
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
    less: generateLoaders('less'),
    sass: generateLoaders('sass', { indentedSyntax: true }),
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
    scss: generateLoaders('sass'),
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
    stylus: generateLoaders('stylus'),
    // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
    styl: generateLoaders('stylus')
  }
}

// Generate loaders for standalone style files (outside of .vue)
exports.styleLoaders = function (options: any) {
  const output = []
  const loaders = exports.cssLoaders(options)

  for (const extension in loaders) {
    const loader = loaders[extension]
    output.push({
      test: new RegExp('\\.' + extension + '$'),
      use: loader
    })
  }

  return output
}

exports.createNotifierCallback = () => {
  const notifier = require('node-notifier')

  return (severity: any, errors: any) => {
    if (severity !== 'error') return

    const error = errors[0]
    const filename = error.file && error.file.split('!').pop()

    notifier.notify({
      title: packageConfig.name,
      message: severity + ': ' + error.name,
      subtitle: filename || '',
      icon: path.join(__dirname, 'logo.png')
    })
  };
}
