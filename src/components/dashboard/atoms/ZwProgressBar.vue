<template>
	<Progress.Root
		:key="indeterminate ? 'indeterminate' : 'determinate'"
		:as="as"
		class="zw-progress"
		:model-value="indeterminate ? undefined : pct"
		:min="0"
		:max="100"
	>
		<Progress.Fill :as="as" class="zw-progress__fill">
			<span v-if="shimmer" class="zw-progress__shimmer" />
		</Progress.Fill>
	</Progress.Root>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Progress } from '@vuetify/v0'

const props = withDefaults(
	defineProps<{
		// Value 0..1 for a determinate bar, null for an indeterminate sweep
		value?: number | null
		// Render as a span where the bar sits inside inline content
		as?: 'div' | 'span'
		shimmer?: boolean
	}>(),
	{ value: null, as: 'div', shimmer: false },
)

const indeterminate = computed(() => props.value == null)
const pct = computed(() =>
	Math.round(Math.min(1, Math.max(0, props.value ?? 0)) * 100),
)
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
