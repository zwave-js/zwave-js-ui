<template>
	<div
		class="zw-progress"
		role="progressbar"
		:aria-valuenow="indeterminate ? undefined : pct"
		aria-valuemin="0"
		aria-valuemax="100"
	>
		<div
			v-if="indeterminate"
			class="zw-progress__fill zw-progress__fill--indeterminate"
		/>
		<div v-else class="zw-progress__fill" :style="{ width: pct + '%' }" />
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Value 0..1 for a determinate bar, null for an indeterminate sweep
const props = withDefaults(defineProps<{ value?: number | null }>(), {
	value: null,
})

const indeterminate = computed(() => props.value == null)
const pct = computed(() =>
	Math.round(Math.min(1, Math.max(0, props.value ?? 0)) * 100),
)
</script>

<style scoped>
.zw-progress {
	position: relative;
	height: 3px;
	border-radius: var(--zw-radius-xs);
	background: var(--zw-accent-soft);
	overflow: hidden;
}

.zw-progress__fill {
	height: 100%;
	border-radius: var(--zw-radius-xs);
	background: var(--zw-accent);
	transition: width 0.3s ease;
}

.zw-progress__fill--indeterminate {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 0;
	width: 40%;
	/* Keyframes translate by multiples of this width, so the two must agree */
	animation: zw-indeterminate 1.4s ease-in-out infinite;
	will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
	.zw-progress__fill--indeterminate {
		animation-duration: 0.01ms;
	}
}
</style>
