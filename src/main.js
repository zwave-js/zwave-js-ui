import Vue from 'vue'
import pinia from './plugins/pinia'
import vuetify from './plugins/vuetify' // path to vuetify export
import router from './router'
import App from './App.vue'
// Custom assets CSS JS
import './assets/css/main.css'

Vue.config.productionTip = false
Vue.config.devtools = true

new Vue({
	pinia,
	vuetify,
	router,
	render: (h) => h(App),
}).$mount('#app')
