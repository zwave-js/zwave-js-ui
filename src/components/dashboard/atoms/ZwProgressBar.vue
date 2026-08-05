<template>
	<!-- Track authored here: `Progress.Root` renders a fragment, so no scope id
	     reaches its element -->
	<!-- :key remounts the context when max or the indeterminate state changes,
	     because v0 reads both only once when it builds the context -->
	<Progress.Root
		:key="`${indeterminate ? 'indeterminate' : 'determinate'}-${max}`"
		renderless
		:model-value="modelValue"
		:max="max"
	>
		<template #default="{ attrs }">
			<component :is="as" class="zw-progress" v-bind="attrs">
				<Progress.Fill as="span" class="zw-progress__fill">
					<span v-if="shimmer" class="zw-progress__shimmer" />
				</Progress.Fill>
			</component>
		</template>
	</Progress.Root>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Progress } from '@vuetify/v0'
import { progressValue } from '@/lib/progress'

const props = withDefaults(
	defineProps<{
		// In 0..`max` units; null for an indeterminate sweep
		value?: number | null
		max?: number
		// Render as a span where the bar sits inside inline content
		as?: 'div' | 'span'
		shimmer?: boolean
	}>(),
	{ value: null, max: 100, as: 'div', shimmer: false },
)

const indeterminate = computed(() => props.value == null)

const modelValue = computed(() => progressValue(props.value))
</script>

<style scoped>
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
