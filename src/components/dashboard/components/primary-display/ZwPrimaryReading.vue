<template>
	<div class="zw-pv-reading">
		<span class="zw-pv-reading__value">{{ pv.value }}</span>
		<span class="zw-pv-reading__unit">{{ pv.unit }}</span>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Device, PrimaryValueReading } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device; compact?: boolean }>()

const pv = computed(() => props.device.primaryValue as PrimaryValueReading)
</script>

<style scoped>
.zw-pv-reading {
	display: inline-flex;
	align-items: baseline;
	gap: 4px;
}

.zw-pv-reading__value {
	font-size: 28px;
	font-weight: 600;
	color: var(--zw-fg);
	line-height: 1;
}

.zw-pv-reading__unit {
	font-size: 14px;
	color: var(--zw-muted);
}
</style>
