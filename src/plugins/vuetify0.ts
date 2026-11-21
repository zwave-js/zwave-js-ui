// V0 theme plugin: emits palette colors as --v0-<name> CSS variables
// (RGB-decomposed) under [data-theme="<id>"] for tokens.css to consume.

import { createThemePlugin, V0StyleSheetThemeAdapter } from '@vuetify/v0'
import type { App } from 'vue'

import { lightColors, darkColors } from './palette.ts'

const themePlugin = createThemePlugin({
	default: 'light',
	themes: {
		light: { dark: false, colors: lightColors },
		dark: { dark: true, colors: darkColors },
	},
	adapter: new V0StyleSheetThemeAdapter({
		prefix: 'v0',
	}),
	rgb: true,
	// tokens.css reads --v0-* from :root, so the theme attr must be on <html>.
	target: 'html',
})

export default function vuetify0(app: App): void {
	app.use(themePlugin)
}
