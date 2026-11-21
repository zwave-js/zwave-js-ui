<template>
	<div v-if="pv" class="zw-pv-lock">
		<div class="zw-pv-lock__label-col">
			<div
				class="zw-pv-lock__label"
				:class="{ 'zw-pv-lock__label--unlocked': !pv.locked }"
			>
				{{ pv.locked ? 'Locked' : 'Unlocked' }}
			</div>
		</div>
		<span class="zw-click-shield" @click.stop>
			<ZwToggle
				:model-value="pv.locked"
				size="md"
				@update:model-value="
					(locked) =>
						emit('action', device, {
							type: 'lock',
							locked,
							valueId: pv.target,
						})
				"
			/>
		</span>
	</div>
</template>

<script setup lang="ts">
import ZwToggle from '@/components/dashboard/atoms/ZwToggle.vue'
import { usePrimaryValue } from './usePrimaryValue'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device; compact?: boolean }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const pv = usePrimaryValue(() => props.device, 'lock')
</script>

<style scoped>
.zw-pv-lock {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}

.zw-pv-lock__label {
	font-size: 22px;
	font-weight: 600;
	color: var(--zw-fg);
	line-height: 1.1;
}

.zw-pv-lock__label--unlocked {
	color: var(--zw-warning);
}
</style>
