<template>
	<span class="zw-cp" @click.stop>
		<!-- toggle -->
		<template v-if="pv?.type === 'toggle'">
			<ZwToggle
				:model-value="pv.on"
				size="sm"
				@update:model-value="
					(on) => emit('action', device, { type: 'toggle', on })
				"
			/>
			<ZwChip tone="neutral">
				{{ pv.on ? 'ON' : 'OFF' }}
			</ZwChip>
		</template>

		<!-- dim — read-only thin fill in the row; editing happens in
			 the expanded body / drawer. -->
		<template v-else-if="pv?.type === 'dim'">
			<span class="zw-cp__bar">
				<span
					class="zw-cp__bar-fill"
					:style="{ width: `${pv.level}%` }"
				/>
			</span>
			<span class="zw-cp__num">{{ pv.level }}%</span>
		</template>

		<!-- lock -->
		<template v-else-if="pv?.type === 'lock'">
			<ZwToggle
				:model-value="pv.locked"
				size="sm"
				@update:model-value="
					(locked) => emit('action', device, { type: 'lock', locked })
				"
			/>
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
import type { Device, DeviceAction, PrimaryValue } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const pv = computed<PrimaryValue | null>(() => props.device.primaryValue)

const stateChipTone = computed(() => {
	const s = pv.value
	if (!s || s.type !== 'state') return 'neutral'
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
