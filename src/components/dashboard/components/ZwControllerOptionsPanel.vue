<template>
	<div class="zw-ctrl-opts">
		<span class="zw-ctrl-opts__title">Controller Options</span>
		<div v-if="options.length" class="zw-ctrl-opts__body">
			<ZwControllerOptionRow
				v-for="(opt, i) in options"
				:key="opt.key"
				:option="opt"
				:sending="isSending(opt.key)"
				:refreshing="isRefreshing(opt.key)"
				:class="{ 'zw-ctrl-opts__row--last': i === options.length - 1 }"
				@change="onChange"
				@refresh="onRefresh"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, shallowRef } from 'vue'
import ZwControllerOptionRow from './ZwControllerOptionRow.vue'
import useBaseStore from '@/stores/base'
import { buildControllerOptions } from '@/lib/controllerOptions.ts'
import {
	controllerPropKey,
	DeviceActionStatusKey,
	type ActionStatus,
} from '@/lib/deviceActionPending.ts'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const baseStore = useBaseStore()

const status = inject(
	DeviceActionStatusKey,
	shallowRef<ReadonlyMap<string, ActionStatus>>(new Map()),
)

const options = computed(() => {
	const zwave = (
		baseStore as unknown as { zwave: { rf: { autoPowerlevels: boolean } } }
	).zwave
	return buildControllerOptions(baseStore.getNode(props.device.nodeId), {
		autoPowerlevels: zwave?.rf?.autoPowerlevels ?? true,
	})
})

const SET_KEY_MAP: Record<string, string> = {
	rfRegion: 'rfRegion',
	powerlevel: 'powerlevel',
	measured0dBm: 'powerlevel',
	maxLRPowerlevel: 'maxLRPowerlevel',
}

const REFRESH_KEY_MAP: Record<string, string> = {
	rfRegion: 'RFRegion',
	powerlevel: 'powerlevel',
	measured0dBm: 'powerlevel',
	maxLRPowerlevel: 'maxLongRangePowerlevel',
}

function isSending(key: string): boolean {
	const prop = SET_KEY_MAP[key] ?? key
	return (
		status.value.get(
			controllerPropKey(props.device.nodeId, 'set', prop),
		) === 'pending'
	)
}

function isRefreshing(key: string): boolean {
	const prop = REFRESH_KEY_MAP[key] ?? key
	return (
		status.value.get(
			controllerPropKey(props.device.nodeId, 'refresh', prop),
		) === 'pending'
	)
}

function onChange(key: string, value: unknown) {
	if (key === 'rfRegion') {
		emit('action', props.device, {
			type: 'set-rf-region',
			region: Number(value),
		})
	} else if (key === 'powerlevel' || key === 'measured0dBm') {
		const node = baseStore.getNode(props.device.nodeId)
		emit('action', props.device, {
			type: 'set-powerlevel',
			powerlevel:
				key === 'powerlevel' ? Number(value) : (node?.powerlevel ?? 0),
			measured0dBm:
				key === 'measured0dBm'
					? Number(value)
					: (node?.measured0dBm ?? 0),
		})
	} else if (key === 'maxLRPowerlevel') {
		emit('action', props.device, {
			type: 'set-max-lr-powerlevel',
			maxLRPowerlevel: Number(value),
		})
	}
}

function onRefresh(key: string) {
	emit('action', props.device, {
		type: 'refresh-controller-prop',
		prop: REFRESH_KEY_MAP[key] ?? key,
	})
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
