<template>
	<div class="zw-pv-toggle" @click.stop>
		<div class="zw-pv-toggle__label-col">
			<div
				class="zw-pv-toggle__label"
				:class="{ 'zw-pv-toggle__label--off': !pv.on }"
			>
				{{ pv.on ? 'On' : 'Off' }}
			</div>
			<div v-if="pv.on && pv.watts != null" class="zw-pv-toggle__caption">
				{{ pv.watts }} W
			</div>
		</div>
		<ZwToggle
			:model-value="pv.on"
			size="md"
			@update:model-value="(on) => emit('action', device, { type: 'toggle', on })"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwToggle from '@/components/dashboard/atoms/ZwToggle.vue'
import type {
	Device,
	DeviceAction,
	PrimaryValueToggle,
} from '@/lib/dashboard-types'

const props = defineProps<{ device: Device; compact?: boolean }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const pv = computed(() => props.device.primaryValue as PrimaryValueToggle)
</script>

<style scoped>
.zw-pv-toggle {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}

.zw-pv-toggle__label-col {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.zw-pv-toggle__label {
	font-size: 22px;
	font-weight: 600;
	color: var(--zw-fg);
	line-height: 1.1;
}

.zw-pv-toggle__label--off {
	color: var(--zw-muted);
}

.zw-pv-toggle__caption {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
}
</style>
