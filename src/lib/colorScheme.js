/**
 * @typedef {('dark' | 'light' | 'system')} ColorScheme
 */

/**
 * @typedef {boolean} DarkMode
 */

/**
 * The valid {@link ColorScheme}s that can be used.
 */
export const colorSchemes = ['dark', 'light', 'system']

/**
 * Maps a {@link ColorScheme} to its corresponding {@link DarkMode} value.
 * Will lookup the preferred value when {@link colorScheme} is `'system'`
 *
 * @param {ColorScheme} colorScheme
 * @returns {DarkMode}
 */
export const colorSchemeToDarkMode = (colorScheme) => {
	switch (colorScheme) {
		case 'dark':
			return true

		case 'light':
			return false

		case 'system':
			return prefersColorSchemeDark.matches
	}
}

/**
 * Loads the {@link ColorScheme} from the {@link settings}.
 *
 * If {@link ColorScheme} is not in the {@link settings},
 * this will fallback to migrating from {@link DarkMode}.
 *
 * @param {Settings} settings
 * @returns {ColorScheme}
 */
export const loadColorScheme = (settings) => {
	const darkMode = settings.load('dark', undefined)
	let defaultColorScheme
	switch (darkMode) {
		case 'false':
			defaultColorScheme = 'light'
			break

		case 'true':
			defaultColorScheme = 'dark'
			break

		case undefined:
			defaultColorScheme = 'system'
			break
	}

	return settings.load('colorScheme', defaultColorScheme)
}

/**
 * Tracks whether the current color scheme should be dark.
 *
 * @type {MediaQueryList}
 */
export const prefersColorSchemeDark = window.matchMedia(
	'(prefers-color-scheme: dark)',
)
