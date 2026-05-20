<template>
	<div class="zw-pv-thermostat">
		<div class="zw-pv-thermostat__row">
			<span class="zw-pv-thermostat__current">{{ pv.value }}</span>
			<span class="zw-pv-thermostat__unit">{{ pv.unit }}</span>
			<span class="zw-pv-thermostat__setpoint">
				→ {{ pv.setpoint }}{{ pv.unit }}
			</span>
		</div>
		<div class="zw-pv-thermostat__mode">{{ pv.mode }}</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
	Device,
	DeviceAction,
	PrimaryValueThermostat,
} from '@/lib/dashboard-types'

const props = defineProps<{ device: Device; compact?: boolean }>()
// Setpoint / mode editing controls live in the drawer; the card variant
// of this renderer is read-only. The emit is still declared so the
// dispatcher's @action passthrough is type-correct.
defineEmits<{ action: [Device, DeviceAction] }>()

const pv = computed(() => props.device.primaryValue as PrimaryValueThermostat)
</script>

<style scoped>
.zw-pv-thermostat {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.zw-pv-thermostat__row {
	display: inline-flex;
	align-items: baseline;
	gap: 6px;
}

.zw-pv-thermostat__current {
	font-size: 24px;
	font-weight: 600;
	color: var(--zw-fg);
	line-height: 1;
}

.zw-pv-thermostat__unit {
	font-size: 13px;
	color: var(--zw-muted);
}

.zw-pv-thermostat__setpoint {
	font-size: 11px;
	color: var(--zw-muted);
}

.zw-pv-thermostat__mode {
	font-size: 11px;
	color: var(--zw-muted);
	text-transform: capitalize;
}
</style>
