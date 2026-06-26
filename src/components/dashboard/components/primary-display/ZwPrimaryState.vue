<template>
	<div v-if="pv" class="zw-pv-state">
		<div
			class="zw-pv-state__value"
			:class="{ 'zw-pv-state__value--alert': isAlert }"
		>
			{{ pv.value }}
		</div>
		<div class="zw-pv-state__caption">{{ device.archetype.label }}</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePrimaryValue } from './usePrimaryValue'
import { isStateAlert } from '@/lib/primaryValue'
import type { Device } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device; compact?: boolean }>()

const pv = usePrimaryValue(() => props.device, 'state')

const isAlert = computed(() => (pv.value ? isStateAlert(pv.value) : false))
</script>

<style scoped>
.zw-pv-state {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.zw-pv-state__value {
	font-size: 22px;
	font-weight: 600;
	color: var(--zw-fg);
	line-height: 1.1;
}

.zw-pv-state__value--alert {
	color: var(--zw-warning);
}

.zw-pv-state__caption {
	font-size: 11px;
	color: var(--zw-muted);
}
</style>
