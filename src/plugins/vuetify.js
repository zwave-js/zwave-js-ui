// src/plugins/vuetify.js

import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import { md } from 'vuetify/iconsets/md'
import 'material-design-icons-iconfont/dist/material-design-icons.css'

/** @type { import('vuetify').VuetifyOptions } */
const opts = {
	icons: {
		defaultSet: 'md',
		sets: {
			md,
		},
	},
	theme: {
		themes: {
			dark: {
				colors: {
					purple: '#BA68C8',
				},
			},
			light: {
				colors: {
					purple: '#BA68C8',
				},
			},
		},
	},
	defaults: {
		// Keep v2 input style with underlined variant
		VTextField: {
			variant: 'underlined',
		},
		VSelect: {
			variant: 'underlined',
		},
		VTextarea: {
			variant: 'underlined',
		},
		VAutocomplete: {
			variant: 'underlined',
		},
		VCombobox: {
			variant: 'underlined',
		},
		// Keep v2 button style with text variant as default
		VBtn: {
			variant: 'text',
		},
	},
}

export default createVuetify(opts)
