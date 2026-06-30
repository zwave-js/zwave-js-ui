<template>
	<div class="zw-assoc">
		<div class="zw-assoc__groups">
			<div v-if="!groups.length" class="zw-assoc__empty">
				No association groups available.
			</div>
			<div v-for="g in groups" :key="g.name" class="zw-assoc__group">
				<span class="zw-assoc__name">
					<LinkIcon
						:size="ICON_SIZE.caret"
						class="zw-assoc__link-icon"
					/>
					{{ g.name }}
				</span>
				<span class="zw-assoc__members">{{ g.members }}</span>
				<span class="zw-assoc__count">{{ g.count }}</span>
			</div>
		</div>

		<ZwActionList>
			<ZwActionBtn
				title="Clear all associations"
				description="Remove every target from this node's association groups."
				:actions="[
					{
						label: 'Clear',
						busyLabel: 'Clearing…',
						doneLabel: 'Cleared',
					},
				]"
				tone="danger"
				@run="emit('action', device, { type: 'clear-associations' })"
			>
				<template #icon><TrashIcon :size="ICON_SIZE.std" /></template>
			</ZwActionBtn>
			<ZwActionBtn
				title="Remove from all associations"
				description="Remove this node as a target from every other node's groups."
				:actions="[
					{
						label: 'Remove',
						busyLabel: 'Removing…',
						doneLabel: 'Removed',
					},
				]"
				tone="danger"
				@run="
					emit('action', device, { type: 'remove-all-associations' })
				"
			>
				<template #icon><LinkIcon :size="ICON_SIZE.std" /></template>
			</ZwActionBtn>
		</ZwActionList>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwActionList from './ZwActionList.vue'
import ZwActionBtn from './ZwActionBtn.vue'
import { ICON_SIZE, LinkIcon, TrashIcon } from '@/lib/icons'
import useBaseStore from '@/stores/base'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const baseStore = useBaseStore()

interface AssocGroup {
	name: string
	members: string
	count: string
}

const groups = computed<AssocGroup[]>(() => {
	const node = baseStore.getNode(props.device.nodeId)
	const raw = node?.groups ?? []
	return raw.map((g: Record<string, unknown>) => ({
		name: String(g.title ?? `Group ${g.value ?? '?'}`),
		members: '—',
		count: `?/${g.maxNodes ?? '?'}`,
	}))
})
</script>

<style scoped>
.zw-assoc {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.zw-assoc__groups {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.zw-assoc__group {
	display: grid;
	grid-template-columns: 120px 1fr auto;
	align-items: center;
	gap: 8px;
	padding: 9px 11px;
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 5px;
	font-family: var(--zw-mono);
	font-size: 11px;
}

.zw-assoc__name {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.zw-assoc__link-icon {
	color: var(--zw-muted);
}

.zw-assoc__members {
	color: var(--zw-muted);
}

.zw-assoc__count {
	color: var(--zw-muted);
}

.zw-assoc__empty {
	font-size: 12px;
	color: var(--zw-muted);
	padding: 9px 11px;
}
</style>
