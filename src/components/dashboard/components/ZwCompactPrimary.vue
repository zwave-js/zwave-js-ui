<template>
	<span class="zw-cp" @click.stop>
		<!-- toggle -->
		<template v-if="pv?.type === 'toggle'">
			<ZwToggle
				:model-value="(pv as PrimaryValueToggle).on"
				size="sm"
				@update:model-value="
					(on) => emit('action', device, { type: 'toggle', on })
				"
			/>
			<ZwChip tone="neutral">
				{{ (pv as PrimaryValueToggle).on ? 'ON' : 'OFF' }}
			</ZwChip>
		</template>

		<!-- dim — read-only thin fill in the row; editing happens in
			 the expanded body / drawer. -->
		<template v-else-if="pv?.type === 'dim'">
			<span class="zw-cp__bar">
				<span
					class="zw-cp__bar-fill"
					:style="{ width: `${(pv as PrimaryValueDim).level}%` }"
				/>
			</span>
			<span class="zw-cp__num">{{ (pv as PrimaryValueDim).level }}%</span>
		</template>

		<!-- lock -->
		<template v-else-if="pv?.type === 'lock'">
			<ZwToggle
				:model-value="(pv as PrimaryValueLock).locked"
				size="sm"
				@update:model-value="
					(locked) => emit('action', device, { type: 'lock', locked })
				"
			/>
			<ZwChip :tone="(pv as PrimaryValueLock).locked ? 'ok' : 'warn'">
				{{ (pv as PrimaryValueLock).locked ? 'LOCKED' : 'UNLOCKED' }}
			</ZwChip>
		</template>

		<!-- reading -->
		<template v-else-if="pv?.type === 'reading'">
			<span class="zw-cp__num">
				{{ (pv as PrimaryValueReading).value
				}}{{ (pv as PrimaryValueReading).unit }}
			</span>
		</template>

		<!-- state -->
		<template v-else-if="pv?.type === 'state'">
			<ZwChip :tone="stateChipTone">
				{{ (pv as PrimaryValueState).value.toUpperCase() }}
			</ZwChip>
		</template>

		<!-- thermostat -->
		<template v-else-if="pv?.type === 'thermostat'">
			<span class="zw-cp__num">
				{{ (pv as PrimaryValueThermostat).value
				}}{{ (pv as PrimaryValueThermostat).unit }}
			</span>
			<span class="zw-cp__sub">
				→ {{ (pv as PrimaryValueThermostat).setpoint
				}}{{ (pv as PrimaryValueThermostat).unit }}
			</span>
		</template>
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwToggle from '@/components/dashboard/atoms/ZwToggle.vue'
import ZwChip from '@/components/dashboard/atoms/ZwChip.vue'
import type {
	Device,
	DeviceAction,
	PrimaryValue,
	PrimaryValueToggle,
	PrimaryValueDim,
	PrimaryValueLock,
	PrimaryValueReading,
	PrimaryValueState,
	PrimaryValueThermostat,
} from '@/lib/dashboard-types'

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const pv = computed<PrimaryValue | null>(() => props.device.primaryValue)

const stateChipTone = computed(() => {
	const s = pv.value as PrimaryValueState | null
	if (!s) return 'neutral'
	if (s.stateIdx !== 1) return 'neutral'
	const c = s.colors[1]
	if (c === 'red') return 'danger'
	if (c === 'amber') return 'warn'
	return 'neutral'
})
</script>

<style scoped>
.zw-cp {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	white-space: nowrap;
}

.zw-cp__bar {
	position: relative;
	width: 100px;
	max-width: 100%;
	height: 4px;
	background: var(--zw-line);
	border-radius: 2px;
	overflow: hidden;
}

.zw-cp__bar-fill {
	position: absolute;
	inset: 0;
	background: var(--zw-accent);
	border-radius: 2px;
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
