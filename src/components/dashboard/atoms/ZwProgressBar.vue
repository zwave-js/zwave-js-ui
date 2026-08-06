<template>
	<!-- `Progress.Root` renders a fragment, so no scope id reaches its element.
	     The track element must stay authored here -->
	<!-- :key remounts the context when max changes, because v0 reads it only
	     once when it builds the context -->
	<Progress.Root :key="max" renderless :model-value="modelValue" :max="max">
		<template #default="{ attrs }">
			<component
				:is="as"
				v-bind="
					mergeProps(
						{ class: 'zw-progress' },
						rootAttrs(attrs),
						$attrs,
					)
				"
			>
				<Progress.Fill as="span" class="zw-progress__fill">
					<span v-if="shimmer" class="zw-progress__shimmer" />
				</Progress.Fill>
			</component>
		</template>
	</Progress.Root>
</template>

<script setup lang="ts">
import { computed, mergeProps } from 'vue'
import { Progress } from '@vuetify/v0'
import { progressPercent, progressValue } from '@/lib/progress'

const props = withDefaults(
	defineProps<{
		// `value` is in 0..`max` units. `null` renders an indeterminate sweep
		value?: number | null
		max?: number
		// Render as a span where the bar sits inside inline content
		as?: 'div' | 'span'
		shimmer?: boolean
		label?: string
	}>(),
	{
		value: null,
		max: 100,
		as: 'div',
		shimmer: false,
		label: 'Progress',
	},
)

// `Progress.Root` discards fallthrough attrs in renderless mode, so the track
// element below must bind them
defineOptions({ inheritAttrs: false })

const indeterminate = computed(() => props.value == null)

const modelValue = computed(() => progressValue(props.value))

/**
 * Overrides the parts of v0's attribute set that are wrong for this component,
 * keeping `role`, `aria-valuemin` and `aria-valuemax` from v0.
 */
function rootAttrs(v0Attrs: Record<string, unknown>) {
	// v0 points `aria-labelledby` at a `Progress.Label` this component does not
	// render, so name the bar directly instead
	const { 'aria-labelledby': _labelId, ...attrs } = v0Attrs
	const named = { ...attrs, 'aria-label': props.label }

	// v0 reads indeterminate off the segment values, so it cannot tell a bar
	// sitting at 0 from one that never started. `value` decides here instead
	if (indeterminate.value) {
		return {
			...named,
			'aria-busy': true,
			'aria-valuenow': undefined,
			'aria-valuetext': undefined,
			'data-state': 'indeterminate',
			'data-complete': undefined,
		}
	}
	// v0's own total reads 0 until `Progress.Fill` registers its segment, which
	// happens after this slot renders
	const value = Math.min(
		props.max,
		Math.max(0, progressValue(props.value) ?? 0),
	)
	return {
		...named,
		'aria-busy': undefined,
		'aria-valuenow': value,
		'aria-valuetext': `${progressPercent(value, props.max)}%`,
		'data-state': 'determinate',
		'data-complete': value >= props.max ? true : undefined,
	}
}
</script>

<style scoped>
.zw-progress {
	position: relative;
	display: block;
	height: var(--zw-progress-height, 3px);
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
	/* The `zw-indeterminate` keyframes translate by multiples of this width, so
	   both must change together */
	width: 40%;
	border-radius: inherit;
	background: var(--zw-progress-fill, var(--zw-accent));
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
