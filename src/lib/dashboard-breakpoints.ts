// Dashboard layout breakpoints.

// The mobile cutoff, in pixels. This is a CONTAINER-width threshold: the
// dashboard measures its own content area with a ResizeObserver and passes
// it down as `viewport`, so the device row grid (deviceRowGrid) and the
// drawer (ZwDeviceDrawer) collapse on available space, not window size.
//
// It deliberately does NOT derive from Vuetify's display thresholds
// (480 / 760 / 1100 / 1380, see plugins/vuetify.js) — those are window-based
// and none of them is 600 — so a single shared constant is the source of
// truth across the three JS sites that read `viewport`. The drawer's CSS
// `@media (max-width: 600px)` stays a literal (a stylesheet can't read a JS
// constant); keep the two in sync if this ever changes.
export const MOBILE_BREAKPOINT = 600

// Container-width threshold (px) at which the table-row expansion switches
// from the stacked layout to the two-pane layout (left rail + tabbed detail).
// Below this — and always inside the card-view drawer — the stacked layout is
// used. Like MOBILE_BREAKPOINT this is measured against the shell's own width
// (the `viewport` passed down), so it tracks available space, not the window.
export const TWO_PANE_BREAKPOINT = 900

// Two-pane left-rail sizing. At/above RAIL_WIDTH_BREAKPOINT the rail uses the
// spacious width, below it the compact one (matches the design's two widths).
export const RAIL_WIDTH_BREAKPOINT = 1200
export const RAIL_WIDTH_SPACIOUS = 340
export const RAIL_WIDTH_COMPACT = 300
