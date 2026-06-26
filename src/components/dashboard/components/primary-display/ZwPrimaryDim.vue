<template>
	<div v-if="pv" class="zw-pv-dim">
		<div class="zw-pv-dim__top">
			<span class="zw-pv-dim__value">
				{{ pv.level }}<span class="zw-pv-dim__pct">%</span>
			</span>
			<span class="zw-pv-dim__caption">{{ caption }}</span>
		</div>
		<span class="zw-click-shield" @click.stop>
			<ZwSlider
				:model-value="pv.level"
				@update:model-value="
					(level) =>
						emit('action', device, {
							type: 'dim',
							level,
							valueId: pv.target,
						})
				"
			/>
		</span>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwSlider from '@/components/dashboard/atoms/ZwSlider.vue'
import { usePrimaryValue } from './usePrimaryValue'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device; compact?: boolean }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const pv = usePrimaryValue(() => props.device, 'dim')

const caption = computed(() =>
	props.device.archetype.kind === 'shade' ? 'Open' : 'Bright',
)
</script>

<style scoped>
.zw-pv-dim {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.zw-pv-dim__top {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
}

.zw-pv-dim__value {
	font-size: 22px;
	font-weight: 600;
	color: var(--zw-fg);
	line-height: 1;
}

.zw-pv-dim__pct {
	font-size: 14px;
	color: var(--zw-muted);
	margin-left: 2px;
}

.zw-pv-dim__caption {
	font-size: 11px;
	font-weight: 600;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.4px;
}
</style>
