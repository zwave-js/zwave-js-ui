<template>
	<!-- The track is authored here rather than being v0's `Progress.Root`
	     element: Root renders a fragment, so no scope id reaches it and neither
	     this file nor a consumer can style it. -->
	<component
		:is="as"
		class="zw-progress"
		role="progressbar"
		:aria-label="label"
		:aria-valuemin="min"
		:aria-valuemax="max"
		:aria-valuenow="modelValue"
		:aria-valuetext="valueText"
		:aria-busy="indeterminate || undefined"
		:data-state="indeterminate ? 'indeterminate' : 'determinate'"
	>
		<Progress.Root
			:key="indeterminate ? 'indeterminate' : 'determinate'"
			renderless
			:model-value="modelValue"
			:min="min"
			:max="max"
		>
			<Progress.Fill :as="as" class="zw-progress__fill">
				<span v-if="shimmer" class="zw-progress__shimmer" />
			</Progress.Fill>
		</Progress.Root>
	</component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Progress } from '@vuetify/v0'
import { progressValue } from '@/lib/progress'

const props = withDefaults(
	defineProps<{
		// In `min`..`max` units; null for an indeterminate sweep
		value?: number | null
		min?: number
		max?: number
		// Render as a span where the bar sits inside inline content
		as?: 'div' | 'span'
		shimmer?: boolean
		label?: string
	}>(),
	{
		value: null,
		min: 0,
		max: 100,
		as: 'div',
		shimmer: false,
		label: undefined,
	},
)

// v0 captures whether a value was supplied when the progress context is built,
// so `isIndeterminate` never flips afterwards — the `:key` remounts the whole
// context to switch modes
const indeterminate = computed(() => props.value == null)

const modelValue = computed(() =>
	progressValue(props.value, props.min, props.max),
)

const valueText = computed(() => {
	if (modelValue.value === undefined) return undefined
	const extent = props.max - props.min
	if (extent <= 0) return undefined
	return `${Math.round(((modelValue.value - props.min) / extent) * 100)}%`
})
</script>

<style scoped>
/* Tunables so consumers can restyle the bar without fighting the specificity of
   these rules: --zw-progress-h, --zw-progress-radius, --zw-progress-track,
   --zw-progress-fill */
.zw-progress {
	position: relative;
	display: block;
	height: var(--zw-progress-h, 3px);
	border-radius: var(--zw-progress-radius, var(--zw-radius-xs));
	background: var(--zw-progress-track, var(--zw-accent-soft));
	overflow: hidden;
}

.zw-progress__fill {
	position: relative;
	display: block;
	height: 100%;
	border-radius: inherit;
	background: var(--zw-progress-fill, var(--zw-accent));
	transition: width 0.3s ease;
}

/* v0 pins the fill at 0% width while indeterminate, so sweep the track instead */
.zw-progress[data-state='indeterminate'] .zw-progress__fill {
	display: none;
}

.zw-progress[data-state='indeterminate']::after {
	content: '';
	position: absolute;
	inset: 0;
	width: 40%;
	border-radius: inherit;
	background: var(--zw-progress-fill, var(--zw-accent));
	/* Keyframes translate by multiples of this width, so the two must agree */
	animation: zw-indeterminate 1.4s ease-in-out infinite;
	will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
	.zw-progress[data-state='indeterminate']::after {
		animation-duration: 0.01ms;
	}
}

.zw-progress__shimmer {
	position: absolute;
	inset: 0;
	background: linear-gradient(
		to right,
		transparent 0%,
		rgba(255, 255, 255, 0.25) 50%,
		transparent 100%
	);
	transform: translateX(-100%);
	animation: zw-shimmer 4s linear infinite;
	pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
	.zw-progress__shimmer {
		animation: none;
	}
}
</style>
