<template>
	<div class="zw-values">
		<div class="zw-values__toolbar">
			<ZwSearchInput
				v-model="query"
				class="zw-values__search"
				placeholder="Filter values…"
				aria-label="Filter values"
			/>
			<ZwValuesActionsMenu
				@refresh-all="onRefreshAll"
				@expand-all="expandAll"
				@collapse-all="collapseAll"
			/>
		</div>

		<ZwValueGroup
			v-for="g in filtered"
			:key="g.ccId"
			:group="g"
			:open="isOpen(g.ccId)"
			:node-id="device.nodeId"
			@toggle="toggle(g.ccId)"
			@set="onSet"
			@poll="onPoll"
			@refresh-cc="onRefreshCc"
		/>

		<div v-if="groups.length === 0" class="zw-values__empty">
			This node exposes no command-class values yet.
		</div>
		<div v-else-if="filtered.length === 0" class="zw-values__empty">
			No values match “{{ query }}”.
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ZwSearchInput from '@/components/dashboard/atoms/ZwSearchInput.vue'
import ZwValuesActionsMenu from './ZwValuesActionsMenu.vue'
import ZwValueGroup from './ZwValueGroup.vue'
import useBaseStore from '@/stores/base'
import {
	buildValueGroups,
	DEFAULT_OPEN_CCS,
	type ValueGroup,
} from '@/lib/valueGroups.ts'
import type { Device, DeviceAction } from '@/lib/dashboard-types.ts'
import type { ValueID } from '@zwave-js/core'

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const baseStore = useBaseStore()

const groups = computed<ValueGroup[]>(() =>
	buildValueGroups(baseStore.getNode(props.device.nodeId)),
)

const query = ref('')
const open = ref<Set<number>>(new Set())

// Seed the open set once per node: default-open CCs that exist, else first two.
let seededFor: number | null = null
watch(
	groups,
	(gs) => {
		if (seededFor === props.device.nodeId || gs.length === 0) return
		const next = new Set<number>()
		for (const g of gs) if (DEFAULT_OPEN_CCS.has(g.ccId)) next.add(g.ccId)
		if (next.size === 0) for (const g of gs.slice(0, 2)) next.add(g.ccId)
		open.value = next
		seededFor = props.device.nodeId
	},
	{ immediate: true },
)

watch(
	() => props.device.nodeId,
	() => {
		query.value = ''
		seededFor = null
	},
)

const filtered = computed<ValueGroup[]>(() => {
	const q = query.value.trim().toLowerCase()
	if (!q) return groups.value
	return groups.value
		.map((g) => ({
			...g,
			params: g.params.filter(
				(p) =>
					p.label.toLowerCase().includes(q) ||
					p.id.toLowerCase().includes(q),
			),
		}))
		.filter(
			(g) => g.params.length > 0 || g.ccLabel.toLowerCase().includes(q),
		)
})

// An active filter force-expands all groups so matches aren't hidden.
function isOpen(ccId: number): boolean {
	return query.value.trim() ? true : open.value.has(ccId)
}

function toggle(ccId: number) {
	const next = new Set(open.value)
	if (next.has(ccId)) next.delete(ccId)
	else next.add(ccId)
	open.value = next
}

function expandAll() {
	open.value = new Set(groups.value.map((g) => g.ccId))
}

function collapseAll() {
	open.value = new Set()
}

function onRefreshAll() {
	emit('action', props.device, { type: 'refresh' })
}

function onSet(valueId: ValueID, value: unknown) {
	emit('action', props.device, { type: 'set-value', valueId, value })
}

function onPoll(valueId: ValueID) {
	emit('action', props.device, { type: 'poll-value', valueId })
}

function onRefreshCc(commandClass: number) {
	emit('action', props.device, { type: 'refresh-cc', commandClass })
}
</script>

<style scoped>
.zw-values {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.zw-values__toolbar {
	display: flex;
	align-items: center;
	gap: 8px;
}

.zw-values__search {
	flex: 1;
	min-width: 0;
}

.zw-values__empty {
	padding: 20px 12px;
	text-align: center;
	font-size: 12px;
	color: var(--zw-muted);
	font-family: var(--zw-mono);
	border: 1px dashed var(--zw-line);
	border-radius: 6px;
}
</style>
