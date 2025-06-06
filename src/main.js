import Vue from 'vue'
import pinia from './plugins/pinia'
import vuetify from './plugins/vuetify' // path to vuetify export
import router from './router'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'
// Custom assets CSS JS
import './assets/css/main.css'

const updateSW = registerSW({
	onNeedRefresh() {
		console.log('New content available, click on reload button to update.')
		document.dispatchEvent(
			new CustomEvent('swUpdated', { detail: { updateSW } }),
		)
	},
	onOfflineReady() {
		console.log('App is ready for offline usage')
	},
	// check for updates every hour
	registerType: 'autoUpdate',
	interval: 60 * 60 * 1000, // 1 hour
})

Vue.config.productionTip = false
Vue.config.devtools = true

new Vue({
	pinia,
	vuetify,
	router,
	render: (h) => h(App),
}).$mount('#app')
