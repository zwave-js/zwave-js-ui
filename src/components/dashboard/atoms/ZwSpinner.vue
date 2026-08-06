<template>
	<span
		class="zw-spinner"
		:class="`zw-spinner--${tone}`"
		:style="{ '--zw-spinner-size': `${size}px` }"
		role="progressbar"
		aria-busy="true"
		:aria-label="label"
	>
		<svg
			class="zw-spinner__svg zw-spin"
			:viewBox="VIEWBOX"
			aria-hidden="true"
		>
			<circle
				class="zw-spinner__track"
				:cx="CENTER"
				:cy="CENTER"
				:r="RADIUS"
				:stroke-width="strokeUnits"
			/>
			<circle
				class="zw-spinner__arc"
				:cx="CENTER"
				:cy="CENTER"
				:r="RADIUS"
				:stroke-width="strokeUnits"
				:stroke-dasharray="DASH_ARRAY"
			/>
		</svg>
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
	defineProps<{
		size?: number
		tone?: 'accent' | 'danger'
		label?: string
	}>(),
	{ size: 32, tone: 'accent', label: 'Loading' },
)

const SPAN = 24
const CENTER = SPAN / 2
const RADIUS = 10
const VIEWBOX = `0 0 ${SPAN} ${SPAN}`

// `SIZE_TO_STROKE` matches Vuetify's circular progress ratio, so the two look
// alike side by side
const SIZE_TO_STROKE = 12
const MIN_STROKE_PX = 2

const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// `DASH_ARRAY` draws a quarter-circle arc, then a three-quarter gap
const DASH_ARRAY = `${CIRCUMFERENCE / 4} ${CIRCUMFERENCE}`

// The stroke is authored in px but drawn in viewBox units, so scale it by the
// ratio the SVG is rendered at
const strokeUnits = computed(() => {
	const px = Math.max(MIN_STROKE_PX, Math.round(props.size / SIZE_TO_STROKE))
	return (px * SPAN) / props.size
})
</script>

<style scoped>
.zw-spinner {
	display: inline-flex;
	flex: 0 0 auto;
	width: var(--zw-spinner-size);
	height: var(--zw-spinner-size);
}

.zw-spinner--accent {
	color: var(--zw-accent);
}

.zw-spinner--danger {
	color: var(--zw-danger);
}

.zw-spinner__svg {
	width: 100%;
	height: 100%;
}

.zw-spinner__track,
.zw-spinner__arc {
	fill: none;
	stroke: currentColor;
}

.zw-spinner__track {
	opacity: 0.2;
}

.zw-spinner__arc {
	stroke-linecap: round;
}
</style>
