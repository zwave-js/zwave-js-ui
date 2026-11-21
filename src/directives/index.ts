import type { App } from 'vue'
import zwTooltip from './zwTooltip.ts'

// Directive names live here rather than at each `app.directive()` call site, so
// a second entry point can't boot the app without them
export function registerDirectives(app: App): void {
	app.directive('zw-tooltip', zwTooltip)
}
