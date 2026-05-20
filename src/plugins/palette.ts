// Single source of truth for the dashboard color palette.
//
// Imported by:
// - src/plugins/vuetify0.ts → exposed as --v0-<name> CSS variables that
//   src/assets/css/tokens.css reads to compose the --zw-* vocabulary
// - src/plugins/vuetify.js → wired into Vuetify 3's theme system so legacy
//   pages keep picking up the same palette while they're still on Vuetify 3
//
// The two destinations MUST stay in lockstep. Add new colors here, never
// inline them in either plugin file.

// The handoff's colour tables (design-system.jsx:17-37) have no
// `secondary` or `info` entry — the only "secondary" mentioned is the
// muted FG ramp (already covered by --zw-fg-soft) and the info-toned
// pill is implemented as an accent alias at the atom layer. Both keys
// were dropped from this palette; no call site in src/ references them.
export type Palette = Record<string, string> & {
	primary: string
	'primary-darken-1': string
	'primary-soft': string
	success: string
	warning: string
	'warn-soft': string
	error: string
	'error-darken-1': string
	'danger-soft': string
	asleep: string
	surface: string
	background: string
	'background-soft': string
	'on-surface': string
	'on-background': string
	// `on-<accent>` keys exist so atoms can derive contrast text from V0
	// channel vars (e.g. `rgb(var(--v0-on-primary))`) and stay correct in
	// dark mode — flipping to a literal `#fff` would defeat that.
	'on-primary': string
	// Kept for backwards compatibility with the legacy app.
	purple: string
}

export const lightColors: Palette = {
	primary: '#1976D2',
	'primary-darken-1': '#1565C0',
	'primary-soft': '#E3F2FD',
	success: '#43A047',
	warning: '#FB8C00',
	'warn-soft': '#FFF3E0',
	error: '#E53935',
	'error-darken-1': '#C62828',
	'danger-soft': '#FFEBEE',
	asleep: '#9A8DB7',
	surface: '#FFFFFF',
	background: '#F5F5F5',
	'background-soft': '#FAFAFA',
	'on-surface': '#000000',
	'on-background': '#000000',
	'on-primary': '#FFFFFF',
	purple: '#BA68C8',
}

// Dark palette is a placeholder — full dark-mode design is a separate pass.
// Keys MUST all exist or Vuetify 3 throws when a component asks for them, and
// V0 silently drops them. Alpha-based --zw-* tokens flip automatically because
// on-surface flips to white here.
export const darkColors: Palette = {
	primary: '#1976D2',
	'primary-darken-1': '#1565C0',
	'primary-soft': '#0D2A3E',
	success: '#43A047',
	warning: '#FB8C00',
	'warn-soft': '#3A2F18',
	error: '#E53935',
	'error-darken-1': '#EF5350',
	'danger-soft': '#3A1F1F',
	asleep: '#9A8DB7',
	surface: '#1E1E1E',
	background: '#121212',
	'background-soft': '#1A1A1A',
	'on-surface': '#FFFFFF',
	'on-background': '#FFFFFF',
	'on-primary': '#FFFFFF',
	purple: '#BA68C8',
}
