// Vuetify0 (@vuetify/v0) theme plugin — emits the dashboard's color palette
// as --v0-<name> CSS variables on a stylesheet that scopes to
// [data-theme="<id>"]. The variables are RGB-decomposed channels (rgb: true),
// so src/assets/css/tokens.css can compose them via rgb()/rgba() — matching
// the channel form the dashboard's --zw-* tokens already use.
//
// V0 is the headless successor to Vuetify 3 ("Vuetify 5 will be built on
// v0"). New dashboard components target V0 primitives directly; Vuetify 3
// remains installed only to host legacy routes during the rework, and is
// removed once every legacy page has migrated.

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
	// `data-theme` goes on <html> so the [data-theme="<id>"] CSS selector
	// the adapter scopes its --v0-* variables under is visible from :root
	// downward. tokens.css's --zw-* tokens are declared on :root and read
	// the --v0-* values directly, so they need them to resolve there.
	target: 'html',
})

export default function vuetify0(app: App): void {
	app.use(themePlugin)
}
