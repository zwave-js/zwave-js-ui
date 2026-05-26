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

// Palette is shared with the V0 theme plugin via src/plugins/palette.ts.
// Both `light` and `dark` keys must exist or Vuetify throws when a
// component asks for a missing color. `on-surface` is intentionally pure
// black / white so the design's alpha-stepped neutrals
// (`rgba(0,0,0,0.87)`, …) presume an unmixed channel.
import { lightColors, darkColors } from './palette'

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
