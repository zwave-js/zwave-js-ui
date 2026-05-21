import { createApp } from 'vue'
import pinia from './plugins/pinia'
import vuetify0 from './plugins/vuetify0'
import vuetify from './plugins/vuetify' // legacy — removed once Phase 6 lands
import router from './router'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'

// Self-host the dashboard typography. Each @fontsource weight CSS ships
// @font-face rules with unicode-range per subset (latin / latin-ext /
// cyrillic / greek / vietnamese / math / symbols), so the browser only
// downloads the WOFF2s that match the rendered glyphs — same lazy-subset
// behaviour the Google Fonts CDN was providing, but bundled.
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/600.css'
import '@fontsource/roboto/700.css'
import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/500.css'
import '@fontsource/roboto-mono/600.css'

// Custom assets CSS JS — tokens.css must load after vuetify's stylesheet
// (imported transitively from ./plugins/vuetify) so our :root tokens win.
import './assets/css/tokens.css'
import './assets/css/main.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

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

const app = createApp(App)

app.use(pinia)
vuetify0(app)
app.use(vuetify)
app.use(router)

app.mount('#app')
