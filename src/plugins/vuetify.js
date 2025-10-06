// src/plugins/vuetify.js

import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import { aliases, md } from 'vuetify/iconsets/md'
import 'material-design-icons-iconfont/dist/material-design-icons.css' // Ensure you are using css-loader

const inputVariant = 'underlined'
const defaultColor = 'primary'

export default createVuetify({
	icons: {
		defaultSet: 'md',
		aliases,
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
		VSwitch: { color: defaultColor },
		VCheckbox: { color: defaultColor },
		VRadioGroup: { color: defaultColor },
		VTextField: {
			variant: inputVariant,
			color: defaultColor,
		},
		VAutocomplete: {
			variant: inputVariant,
		},
		VTextarea: {
			variant: inputVariant,
		},
		VSelect: {
			variant: inputVariant,
		},
		VCombobox: {
			variant: inputVariant,
		},
		VNumberInput: {
			variant: inputVariant,
		},
		VFileInput: {
			variant: inputVariant,
		},
		VBtn: {
			variant: 'text',
		},
	},
})
