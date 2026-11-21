// Single source of truth for the dashboard color palette.
// Consumed by vuetify0.ts (--v0-* CSS vars) and vuetify.js (Vuetify 3 theme).
// Add new colors here, never inline them in either plugin file.
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
	'on-primary': string
	// Legacy: required by v-alert type="info" in FirmwareUpdates, NodeDetails,
	// TemplateWizard, Zniffer. Remove after dashboard-neo migration.
	info: string
	// Legacy: used by the old dashboard. Remove after dashboard-neo migration.
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
	info: '#1976D2',
	purple: '#BA68C8',
}

// Placeholder — full dark-mode design is a separate pass.
// All keys must exist (Vuetify 3 throws on missing theme colors).
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
	info: '#1976D2',
	purple: '#BA68C8',
}
