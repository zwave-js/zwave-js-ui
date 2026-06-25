<template>
	<DynamicScroller
		class="zw-cards"
		:class="{ 'zw-cards--compact': compact }"
		:items="flatItems"
		:min-item-size="56"
		key-field="id"
		:buffer="400"
	>
		<template #default="{ item, active, index }">
			<DynamicScrollerItem
				:item="item"
				:active="active"
				:size-dependencies="[
					viewport,
					cols,
					item.kind === 'card-row' ? item.devices.length : 0,
				]"
				:data-index="index"
			>
				<div
					v-if="item.kind === 'group-head'"
					class="zw-cards__group-head"
					:class="{ 'zw-cards__group-head--lead': item.lead }"
				>
					<h3 class="zw-cards__group-name">
						{{
							item.key === '__controller'
								? 'Controller'
								: item.key
						}}
					</h3>
					<span
						v-if="item.key !== '__controller'"
						class="zw-cards__group-count"
					>
						{{ item.count }}
					</span>
					<span class="zw-cards__group-line" />
				</div>
				<div
					v-else
					class="zw-cards__grid"
					:style="{
						gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
					}"
				>
					<ZwDeviceCard
						v-for="d in item.devices"
						:key="d.nodeId"
						:device="d"
						@open="(dev) => emit('open', dev)"
						@action="(dev, a) => emit('action', dev, a)"
					/>
				</div>
			</DynamicScrollerItem>
		</template>
		<template #empty>
			<ZwEmptyState />
		</template>
	</DynamicScroller>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import ZwDeviceCard from '@/components/dashboard/components/ZwDeviceCard.vue'
import ZwEmptyState from '@/components/dashboard/components/ZwEmptyState.vue'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

type GroupHeadItem = {
	id: string
	kind: 'group-head'
	key: string
	count: number
	lead: boolean
}

type CardRowItem = {
	id: string
	kind: 'card-row'
	devices: Device[]
}

type FlatItem = GroupHeadItem | CardRowItem

const props = defineProps<{
	groups: [string, Device[]][]
	viewport: number
}>()

const emit = defineEmits<{
	open: [Device]
	action: [Device, DeviceAction]
}>()

const compact = computed(() => props.viewport < 600)

const cols = computed(() => {
	const w = props.viewport
	if (w < 480) return 1
	if (w < 760) return 2
	if (w < 1380) return 3
	if (w < 1700) return 4
	return 5
})

const flatItems = computed<FlatItem[]>(() => {
	const out: FlatItem[] = []
	let groupIndex = 0
	for (const [key, devices] of props.groups) {
		out.push({
			id: `head:${key}`,
			kind: 'group-head',
			key,
			count: devices.length,
			lead: groupIndex === 0,
		})
		const n = cols.value
		for (let i = 0; i < devices.length; i += n) {
			const slice = devices.slice(i, i + n)
			out.push({
				id: `row:${key}:${i}:${slice.map((d) => d.nodeId).join(',')}`,
				kind: 'card-row',
				devices: slice,
			})
		}
		groupIndex++
	}
	return out
})
</script>

<style scoped>
.zw-cards {
	flex: 1;
	background: var(--zw-bg);
	padding: 20px 24px 40px;
}

.zw-cards--compact {
	padding: 14px 12px 32px;
}

.zw-cards__group-head {
	display: flex;
	align-items: baseline;
	gap: 10px;
	padding-top: 16px;
	padding-bottom: 12px;
}

.zw-cards__group-head--lead {
	padding-top: 0;
}

.zw-cards__group-name {
	margin: 0;
	font-size: 15px;
	font-weight: 600;
	letter-spacing: -0.1px;
	color: var(--zw-fg);
}

.zw-cards--compact .zw-cards__group-name {
	font-size: 14px;
}

.zw-cards__group-count {
	font-size: 11px;
	color: var(--zw-fg-soft);
	font-family: var(--zw-mono);
}

.zw-cards__group-line {
	flex: 1;
	height: 1px;
	background: var(--zw-line-soft);
}

.zw-cards__grid {
	display: grid;
	gap: 14px;
	padding-bottom: 14px;
}

.zw-cards--compact .zw-cards__grid {
	gap: 10px;
	padding-bottom: 10px;
}
</style>
