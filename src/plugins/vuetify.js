// src/plugins/vuetify.js

import Vue from 'vue'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import 'material-design-icons-iconfont/dist/material-design-icons.css' // Ensure you are using css-loader

Vue.use(Vuetify)

const opts = {
	icons: {
		iconfont: 'md',
	},
	theme: {
		options: { customProperties: true }, // enable sass/scss variables
	},
}

export default new Vuetify(opts)
