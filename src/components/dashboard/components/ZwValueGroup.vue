<template>
	<div class="zw-vgroup">
		<div
			class="zw-vgroup__head"
			role="button"
			tabindex="0"
			:aria-expanded="open"
			@click="emit('toggle')"
			@keydown.enter.prevent="emit('toggle')"
			@keydown.space.prevent="emit('toggle')"
		>
			<ChevronDownIcon
				:size="ICON_SIZE.chip"
				class="zw-vgroup__chev"
				:class="{ 'zw-vgroup__chev--collapsed': !open }"
			/>
			<span class="zw-vgroup__label">{{ group.ccLabel }}</span>
			<span class="zw-vgroup__version">v{{ group.version }}</span>
			<span class="zw-vgroup__spacer" />
			<span class="zw-vgroup__actions" @click.stop>
				<button
					type="button"
					class="zw-vgroup__act zw-focus-ring"
					:disabled="refreshing"
					:title="refreshing ? 'Refreshing…' : 'Refresh values'"
					@click="onRefresh"
				>
					<RefreshIcon
						:size="ICON_SIZE.dense"
						:class="{ 'zw-spin': refreshing }"
					/>
				</button>
				<button
					v-if="group.canResetAll"
					type="button"
					class="zw-vgroup__act zw-vgroup__act--danger zw-focus-ring"
					title="Reset all to default"
					@click="onResetAll"
				>
					<ResetIcon :size="ICON_SIZE.dense" />
				</button>
			</span>
		</div>

		<div v-if="open" class="zw-vgroup__body">
			<template v-if="group.params.length">
				<div
					v-for="p in group.params"
					:key="p.id"
					class="zw-vgroup__cell"
				>
					<ZwValueRow
						:param="p"
						:node-id="nodeId"
						@set="(id, val) => emit('set', id, val)"
						@poll="(id) => emit('poll', id)"
					/>
				</div>
			</template>
			<div v-else class="zw-vgroup__empty">No values</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, shallowRef } from 'vue'
import ZwValueRow from './ZwValueRow.vue'
import { ChevronDownIcon, ICON_SIZE, RefreshIcon, ResetIcon } from '@/lib/icons'
import {
	ccPendingKey,
	DeviceActionStatusKey,
	type ActionStatus,
} from '@/lib/deviceActionPending.ts'
import type { ValueGroup } from '@/lib/valueGroups.ts'
import type { ValueID } from '@zwave-js/core'

const props = defineProps<{
	group: ValueGroup
	open: boolean
	nodeId: number
}>()

const emit = defineEmits<{
	toggle: []
	set: [ValueID, unknown]
	poll: [ValueID]
	refreshCc: [number]
}>()

const status = inject(
	DeviceActionStatusKey,
	shallowRef<ReadonlyMap<string, ActionStatus>>(new Map()),
)
const refreshing = computed(
	() =>
		status.value.get(ccPendingKey(props.nodeId, props.group.ccId)) ===
		'pending',
)

function onRefresh() {
	if (refreshing.value) return
	emit('refreshCc', props.group.ccId)
}

function onResetAll() {
	for (const p of props.group.params) {
		if (p.modified && p.default !== undefined)
			emit('set', p.target, p.default)
	}
}
</script>

<style scoped>
.zw-vgroup {
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	overflow: hidden;
}

.zw-vgroup__head {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 12px;
	cursor: pointer;
}

.zw-vgroup__head:focus-visible {
	outline: 2px solid var(--zw-accent);
	outline-offset: -2px;
}

.zw-vgroup__chev {
	color: var(--zw-muted);
	transition: transform 0.15s;
	flex-shrink: 0;
}

.zw-vgroup__chev--collapsed {
	transform: rotate(-90deg);
}

.zw-vgroup__label {
	font-size: 12px;
	font-weight: 600;
	color: var(--zw-fg);
}

.zw-vgroup__version {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	padding: 1px 5px;
	background: var(--zw-chip-bg);
	border-radius: 3px;
}

.zw-vgroup__spacer {
	flex: 1;
}

.zw-vgroup__actions {
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.zw-vgroup__act {
	appearance: none;
	border: 1px solid var(--zw-line);
	background: transparent;
	color: var(--zw-muted);
	width: 26px;
	height: 26px;
	border-radius: 5px;
	padding: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
}

.zw-vgroup__act:disabled {
	cursor: default;
	opacity: 0.65;
}

.zw-vgroup__act--danger {
	color: var(--zw-danger);
}

/* Responsive grid in every host (card drawer and table two-pane) so the
   wrap breakpoints match. Cell rules are the 1px gap over a line-colored
   backdrop; `background-clip: padding-box` keeps that tint from painting
   under the header border-top (which would read darker than nearby 1px
   lines). */
.zw-vgroup__body {
	border-top: 1px solid var(--zw-line);
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 1px;
	background: var(--zw-line);
	background-clip: padding-box;
}

/* Flex so the single ZwValueRow stretches to the cell's (grid-equalized)
   height — letting a short row (e.g. a button command) center vertically. */
.zw-vgroup__cell {
	background: var(--zw-card);
	display: flex;
}

.zw-vgroup__empty {
	padding: 12px;
	font-size: 11px;
	color: var(--zw-muted);
	font-family: var(--zw-mono);
	background: var(--zw-card);
}
</style>
