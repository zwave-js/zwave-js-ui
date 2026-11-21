<template>
	<span
		class="zw-status-dot"
		:class="`zw-status-dot--${status}`"
		:style="sizeStyle"
		:title="label ?? defaultLabel"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Status = 'alive' | 'awake' | 'asleep' | 'dead' | 'controller'

const props = withDefaults(
	defineProps<{
		status: Status
		size?: number
		// Override the default status-derived tooltip.
		label?: string
	}>(),
	{ size: 8 },
)

// Default tooltip: the status name, Title-cased.
const defaultLabel = computed(
	() => props.status.charAt(0).toUpperCase() + props.status.slice(1),
)

// Skip the style binding at the default size (avoids per-row allocation).
const sizeStyle = computed(() =>
	props.size === 8
		? undefined
		: { '--zw-status-dot-size': `${props.size}px` },
)
</script>

<style scoped>
.zw-status-dot {
	display: inline-block;
	width: var(--zw-status-dot-size, 8px);
	height: var(--zw-status-dot-size, 8px);
	border-radius: 50%;
	vertical-align: middle;
}

.zw-status-dot--alive {
	background: var(--zw-ok);
}

.zw-status-dot--awake {
	background: var(--zw-ok);
	/* Static halo — alpha 0x33 = 20%. */
	box-shadow: 0 0 0 3px rgba(var(--v0-success), 0.2);
}

.zw-status-dot--asleep {
	background: var(--zw-muted);
}

.zw-status-dot--dead {
	background: var(--zw-danger);
}

.zw-status-dot--controller {
	background: var(--zw-accent);
}
</style>
