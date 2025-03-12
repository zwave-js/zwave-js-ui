// src/plugins/vuetify.js

import Vue from 'vue'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import 'material-design-icons-iconfont/dist/material-design-icons.css' // Ensure you are using css-loader

Vue.use(Vuetify)

/** @type { import('vuetify').UserVuetifyPreset } */
const opts = {
	icons: {
		iconfont: 'md',
	},
	theme: {
		options: { customProperties: true }, // enable sass/scss variables
		themes: {
			dark: {
				purple: '#BA68C8',
				primary: '#42A5F5',
				warning: '#FFB74D',
				success: '#81C784',
				error: '#EF5350',
				info: '#42A5F5',
			},
		},
	},
}

export default new Vuetify(opts)
