// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import '@babel/polyfill'

import Vue from 'vue'
// @ts-expect-error ts-migrate(2307) FIXME: Cannot find module './App' or its corresponding ty... Remove this comment to see the full error message
import App from './App'
import router from './router'
import store from './store'
// @ts-expect-error ts-migrate(2307) FIXME: Cannot find module '@/plugins/vuetify' or its corr... Remove this comment to see the full error message
import vuetify from '@/plugins/vuetify' // path to vuetify export

import 'axios-progress-bar/dist/nprogress.css'
import 'vue-d3-network/dist/vue-d3-network.css'

// Custom assets CSS JS
require('./assets/css/my-progress.css')
require('./assets/css/my-mesh.css')

Vue.config.productionTip = false
Vue.config.devtools = true

/* eslint-disable no-new */
new Vue({
  vuetify,
  router,
  store,
  components: { App },
  template: '<App/>'
}).$mount('#app')
