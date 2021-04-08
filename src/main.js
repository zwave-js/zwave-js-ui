// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import '@babel/polyfill'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { store } from './store'
import vuetify from '@/plugins/vuetify' // path to vuetify export

import 'axios-progress-bar/dist/nprogress.css'
// Custom assets CSS JS
import './assets/css/my-progress.css'

const app = createApp(App)
app.use(vuetify)
app.use(router)
app.use(store)

app.mount('#app')
