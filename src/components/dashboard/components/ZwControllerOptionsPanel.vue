<template>
	<div class="zw-ctrl-opts">
		<span class="zw-ctrl-opts__title">Controller Options</span>
		<div v-if="options.length" class="zw-ctrl-opts__body">
			<ZwControllerOptionRow
				v-for="(opt, i) in options"
				:key="opt.key"
				:option="opt"
				:class="{ 'zw-ctrl-opts__row--last': i === options.length - 1 }"
				@change="onChange"
				@refresh="onRefresh"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwControllerOptionRow from './ZwControllerOptionRow.vue'
import useBaseStore from '@/stores/base'
import { buildControllerOptions } from '@/lib/controllerOptions.ts'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const baseStore = useBaseStore()

const options = computed(() =>
	buildControllerOptions(baseStore.getNode(props.device.nodeId)),
)

function onChange(key: string, value: unknown) {
	if (key === 'rfRegion') {
		emit('action', props.device, {
			type: 'set-rf-region',
			region: Number(value),
		})
	} else if (key === 'measured0dBm') {
		const node = baseStore.getNode(props.device.nodeId)
		emit('action', props.device, {
			type: 'set-powerlevel',
			powerlevel: node?.powerlevel ?? 0,
			measured0dBm: Number(value),
		})
	}
}

function onRefresh(_key: string) {
	emit('action', props.device, { type: 'refresh' })
}
</script>

<style>
.zw-ctrl-opts {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.zw-ctrl-opts__title {
	font-family: var(--zw-mono);
	font-size: 10px;
	font-weight: 600;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.zw-ctrl-opts__body {
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	overflow: hidden;
}

.zw-ctrl-opts__body > .zw-optrow:not(.zw-ctrl-opts__row--last) {
	border-bottom: 1px solid var(--zw-line);
}
</style>
