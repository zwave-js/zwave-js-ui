<template>
	<span v-if="pct != null" class="zw-bat" :data-level="level">
		<span class="zw-bat__cell">
			<span class="zw-bat__fill" :style="{ '--zw-bat-pct': pct }" />
			<span class="zw-bat__nub" />
		</span>
		<span class="zw-bat__label">{{ pct }}%</span>
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ pct?: number | null }>()

const level = computed<'low' | 'mid' | 'ok' | null>(() => {
	const v = props.pct
	if (v == null) return null
	if (v < 15) return 'low'
	if (v < 30) return 'mid'
	return 'ok'
})
</script>

<style scoped>
.zw-bat {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font: var(--zw-text-mono-micro);
	font-variant-numeric: tabular-nums;
}

.zw-bat__cell {
	position: relative;
	width: 18px;
	height: 9px;
	border: 1px solid var(--zw-fg-soft);
	border-radius: 1.5px;
	box-sizing: border-box;
}

/* 1px inset from border; clamp to 2px min so 1% still shows. */
.zw-bat__fill {
	position: absolute;
	top: 1px;
	bottom: 1px;
	left: 1px;
	border-radius: 0.5px;
	width: max(2px, calc(var(--zw-bat-pct, 0) * 0.14px));
}

.zw-bat[data-level='ok'] .zw-bat__fill {
	background: var(--zw-ok);
}

.zw-bat[data-level='mid'] .zw-bat__fill {
	background: var(--zw-warning);
}

.zw-bat[data-level='low'] .zw-bat__fill {
	background: var(--zw-danger);
}

.zw-bat[data-level='low'] .zw-bat__label {
	color: var(--zw-danger);
}

.zw-bat__nub {
	position: absolute;
	top: 2px;
	right: -3px;
	width: 2px;
	height: 4px;
	background: var(--zw-fg-soft);
	border-radius: 0 1px 1px 0;
}
</style>
