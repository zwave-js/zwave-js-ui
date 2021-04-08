import { defineConfig } from 'vite'
import copy from 'rollup-plugin-copy'
import vue from '@vitejs/plugin-vue'
import html from 'vite-plugin-html'
import path from 'path'

// import copy from 'rollup-plugin-copy'

const appConfig = require('./config/webConfig')

export default defineConfig({
  define: { 'process.env': require('./config/dev.env') },
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }]
  },
  plugins: [
    vue(),
    copy({
      targets: [{ src: 'static/**', dest: 'dist/static' }],
      hook: 'writeBundle'
    }),
    html({
      inject: {
        injectData: {
          config: appConfig
        }
      },
      minify: true
    })
  ]
})
