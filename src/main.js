// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import '@babel/polyfill'

import Vue from 'vue'
import pinia from './plugins/pinia'
import vuetify from './plugins/vuetify' // path to vuetify export
import router from './router'
import App from './App'

import 'axios-progress-bar/dist/nprogress.css'
// Custom assets CSS JS
require('./assets/css/main.css')

Vue.config.productionTip = false
Vue.config.devtools = true

/* eslint-disable no-new */
new Vue({
	pinia,
	vuetify,
	router,
	components: { App },
	template: '<App/>',
}).$mount('#app')
