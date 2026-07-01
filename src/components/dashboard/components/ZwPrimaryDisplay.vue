<template>
	<component
		v-if="renderer"
		:is="renderer"
		:device="device"
		:compact="compact"
		@action="(d: Device, a: DeviceAction) => emit('action', d, a)"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PRIMARY_RENDERERS, type PrimaryKey } from './primary-display/registry'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device; compact?: boolean }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const key = computed<PrimaryKey | null>(() => {
	return props.device.primaryValue?.type ?? null
})

const renderer = computed(() =>
	key.value ? PRIMARY_RENDERERS[key.value] : null,
)
</script>
