// src/plugins/vuetify.js

import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import { md } from 'vuetify/iconsets/md'
import 'material-design-icons-iconfont/dist/material-design-icons.css' // Ensure you are using css-loader

const opts = {
	icons: {
		defaultSet: 'md',
		sets: {
			md,
		},
	},
	theme: {
		defaultTheme: 'light',
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
	// Set default variants for backward compatibility
	defaults: {
		VTextField: {
			variant: 'underlined',
		},
		VSelect: {
			variant: 'underlined',
		},
		VCombobox: {
			variant: 'underlined',
		},
		VAutocomplete: {
			variant: 'underlined',
		},
		VBtn: {
			variant: 'text',
		},
	},
}

export default createVuetify(opts)
