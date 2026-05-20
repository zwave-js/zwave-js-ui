// src/plugins/vuetify.js
//
// Vuetify configuration for the unified Material palette and dashboard
// component defaults. Pairs with src/assets/css/tokens.css which exposes
// the same vocabulary as CSS custom properties on :root.
//
// IMPORTANT: import order — `vuetify/styles` must come BEFORE tokens.css
// so our token overrides win. tokens.css is imported in src/main.js.

import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import { aliases, md } from 'vuetify/iconsets/md'
import 'material-design-icons-iconfont/dist/material-design-icons.css'

const lightColors = {
	primary: '#1976D2',
	'primary-darken-1': '#1565C0',
	'primary-soft': '#E3F2FD',
	secondary: '#1976D2',
	success: '#43A047',
	warning: '#FB8C00',
	'warn-soft': '#FFF3E0',
	error: '#E53935',
	'danger-soft': '#FFEBEE',
	info: '#1976D2',
	asleep: '#9A8DB7',
	surface: '#FFFFFF',
	background: '#F5F5F5',
	'background-soft': '#FAFAFA',
	'on-surface': 'rgba(0,0,0,0.87)',
	'on-surface-variant': 'rgba(0,0,0,0.54)',
	// Kept for backwards compatibility with the legacy app.
	purple: '#BA68C8',
}

// Dark palette is placeholder — full dark-mode design is a separate pass.
// The keys MUST exist or Vuetify throws when a component asks for them.
const darkColors = {
	primary: '#1976D2',
	'primary-darken-1': '#1565C0',
	'primary-soft': '#0D2A3E',
	secondary: '#1976D2',
	success: '#43A047',
	warning: '#FB8C00',
	'warn-soft': '#3A2F18',
	error: '#E53935',
	'danger-soft': '#3A1F1F',
	info: '#1976D2',
	asleep: '#9A8DB7',
	surface: '#1E1E1E',
	background: '#121212',
	'background-soft': '#1A1A1A',
	'on-surface': 'rgba(255,255,255,0.87)',
	'on-surface-variant': 'rgba(255,255,255,0.6)',
	purple: '#BA68C8',
}

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
			light: { colors: lightColors },
			dark: { colors: darkColors },
		},
	},
	display: {
		// Align with CardsBody grid math: 480 / 760 / 1100 / 1380 cutoffs
		// yield 1/2/3/4/5 card columns without conditional CSS.
		thresholds: {
			xs: 480,
			sm: 760,
			md: 1100,
			lg: 1380,
			xl: 1920,
		},
	},
	defaults: {
		VBtn: {
			variant: 'flat',
			density: 'comfortable',
			rounded: 'md',
		},
		VBtnToggle: {
			mandatory: true,
			density: 'compact',
			variant: 'flat',
			divided: false,
		},
		VCard: {
			elevation: 2,
			rounded: 'sm',
			hover: true,
		},
		VChip: {
			variant: 'tonal',
			size: 'small',
			rounded: 'pill',
		},
		VSwitch: {
			color: 'primary',
			inset: true,
			density: 'compact',
			hideDetails: true,
		},
		VProgressLinear: {
			color: 'primary',
			bgColor: 'primary',
			bgOpacity: 0.18,
			height: 4,
			rounded: true,
		},
		VTextField: {
			variant: 'outlined',
			density: 'compact',
			hideDetails: 'auto',
			color: 'primary',
		},
		VSelect: {
			variant: 'outlined',
			density: 'compact',
			hideDetails: 'auto',
		},
		VAutocomplete: {
			variant: 'outlined',
			density: 'compact',
			hideDetails: 'auto',
		},
		VCombobox: {
			variant: 'outlined',
			density: 'compact',
			hideDetails: 'auto',
		},
		VNumberInput: {
			variant: 'outlined',
			density: 'compact',
			hideDetails: 'auto',
		},
		VTextarea: {
			variant: 'outlined',
			density: 'compact',
			hideDetails: 'auto',
		},
		VFileInput: {
			variant: 'outlined',
			density: 'compact',
			hideDetails: 'auto',
		},
		VCheckbox: {
			color: 'primary',
		},
		VRadioGroup: {
			color: 'primary',
		},
		VTabs: {
			sliderColor: 'primary',
			density: 'compact',
			alignTabs: 'start',
		},
		VNavigationDrawer: {
			color: 'surface',
			border: 0,
		},
		VAppBar: {
			flat: true,
			density: 'compact',
			color: 'surface',
		},
		VList: {
			density: 'compact',
			nav: true,
		},
		VListItem: {
			density: 'compact',
		},
		VMenu: {
			transition: 'fade-transition',
			offset: 6,
			location: 'bottom end',
		},
		VTooltip: {
			location: 'bottom',
		},
		VDialog: {
			transition: 'fade-transition',
		},
	},
})
