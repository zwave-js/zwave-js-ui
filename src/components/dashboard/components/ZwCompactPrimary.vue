<template>
	<span class="zw-cp">
		<!-- toggle -->
		<template v-if="pv?.type === 'toggle'">
			<span class="zw-click-shield" @click.stop>
				<ZwToggle
					:model-value="pv.on"
					size="sm"
					@update:model-value="onToggle"
				/>
			</span>
			<ZwChip tone="neutral">
				{{ pv.on ? 'ON' : 'OFF' }}
			</ZwChip>
		</template>

		<!-- dim — interactive small slider -->
		<template v-else-if="pv?.type === 'dim'">
			<span class="zw-cp__slider" @click.stop>
				<ZwSlider
					size="sm"
					:model-value="pv.level"
					@update:model-value="onDim"
				/>
			</span>
			<span class="zw-cp__num">{{ pv.level }}%</span>
		</template>

		<!-- lock -->
		<template v-else-if="pv?.type === 'lock'">
			<span class="zw-click-shield" @click.stop>
				<ZwToggle
					:model-value="pv.locked"
					size="sm"
					@update:model-value="onLock"
				/>
			</span>
			<ZwChip :tone="pv.locked ? 'ok' : 'warn'">
				{{ pv.locked ? 'LOCKED' : 'UNLOCKED' }}
			</ZwChip>
		</template>

		<!-- reading -->
		<template v-else-if="pv?.type === 'reading'">
			<span class="zw-cp__num"> {{ pv.value }}{{ pv.unit }} </span>
		</template>

		<!-- state -->
		<template v-else-if="pv?.type === 'state'">
			<ZwChip :tone="stateChipTone">
				{{ pv.value.toUpperCase() }}
			</ZwChip>
		</template>

		<!-- thermostat -->
		<template v-else-if="pv?.type === 'thermostat'">
			<span class="zw-cp__num"> {{ pv.value }}{{ pv.unit }} </span>
			<span class="zw-cp__sub"> → {{ pv.setpoint }}{{ pv.unit }} </span>
		</template>
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwToggle from '@/components/dashboard/atoms/ZwToggle.vue'
import ZwChip from '@/components/dashboard/atoms/ZwChip.vue'
import ZwSlider from '@/components/dashboard/atoms/ZwSlider.vue'
import { isStateAlert } from '@/lib/primaryValue'
import type { Device, DeviceAction, PrimaryValue } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const pv = computed<PrimaryValue | null>(() => props.device.primaryValue)

const stateChipTone = computed(() => {
	const s = pv.value
	if (!s || s.type !== 'state' || !isStateAlert(s)) return 'neutral'
	// isStateAlert guarantees the colour is red or amber.
	return s.colors[1] === 'red' ? 'danger' : 'warn'
})

function onToggle(on: boolean) {
	const v = pv.value
	if (v?.type === 'toggle')
		emit('action', props.device, { type: 'toggle', on, valueId: v.target })
}
function onDim(level: number) {
	const v = pv.value
	if (v?.type === 'dim')
		emit('action', props.device, { type: 'dim', level, valueId: v.target })
}
function onLock(locked: boolean) {
	const v = pv.value
	if (v?.type === 'lock')
		emit('action', props.device, {
			type: 'lock',
			locked,
			valueId: v.target,
		})
}
</script>

<style scoped>
.zw-cp {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	white-space: nowrap;
}

.zw-cp__slider {
	display: inline-block;
	width: 100px;
	max-width: 100%;
}

.zw-cp__num {
	font-family: var(--zw-mono);
	font-size: 11px;
	font-variant-numeric: tabular-nums;
	color: var(--zw-fg);
}

.zw-cp__sub {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
}
</style>
