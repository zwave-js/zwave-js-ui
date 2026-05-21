<template>
	<div
		ref="rootRef"
		class="zw-table"
		:class="{ 'zw-table--has-header': !!headerCells }"
		:style="{ '--zw-table-sbw': `${scrollbarW}px` }"
	>
		<div
			v-if="headerCells"
			class="zw-table__header"
			:style="{ gridTemplateColumns: headerTemplate }"
		>
			<template v-for="cell in headerCells" :key="cell.key">
				<button
					v-if="cell.sortable"
					type="button"
					class="zw-table__head-btn"
					:class="{
						'is-active': cell.active,
						'zw-table__head-btn--right': cell.rightAlign,
					}"
					:title="`Sort by ${cell.label || cell.key}`"
					@click="emit('sort', cell.sortKey as SortKey)"
				>
					<span>{{ cell.label || (cell.key === 'transient' ? 'Activity' : cell.key) }}</span>
					<component
						:is="cell.active && sort.dir === 'desc' ? ArrowDownIcon : ArrowUpIcon"
						:size="ICON_SIZE.sortArrow"
						:style="{ opacity: cell.active ? 1 : 0.28 }"
					/>
				</button>
				<span
					v-else
					class="zw-table__head-static"
					:class="{ 'zw-table__head-static--right': cell.rightAlign }"
				>
					{{ cell.label }}
				</span>
			</template>
		</div>

		<DynamicScroller
			ref="scrollerRef"
			class="zw-table__body"
			:items="flatItems"
			:min-item-size="42"
			key-field="id"
			:buffer="600"
		>
			<template #default="{ item, active }">
				<DynamicScrollerItem
					:item="item"
					:active="active"
					:size-dependencies="[viewport, columns.length, item.kind === 'expanded' ? 1 : 0]"
				>
					<div
						v-if="item.kind === 'group-head'"
						class="zw-table__group-head"
						@click="emit('toggleGroup', item.key)"
					>
						<ChevronDownIcon
							:size="ICON_SIZE.sortArrow"
							class="zw-table__group-chev"
							:class="{ 'zw-table__group-chev--collapsed': item.collapsed }"
						/>
						<span class="zw-table__group-name">
							{{ item.key === '__controller' ? 'Controller' : item.key }}
						</span>
						<span
							v-if="item.key !== '__controller'"
							class="zw-table__group-count"
						>
							{{ item.count }}
						</span>
					</div>
					<ZwDeviceRow
						v-else-if="item.kind === 'row'"
						:device="item.device"
						:expanded="expandedId === item.device.id"
						:columns="columns as ToggleableCol[]"
						:viewport="viewport"
						@expand="(id) => emit('expand', id)"
						@action="(dev, a) => emit('action', dev, a)"
					/>
					<ZwExpandedRow
						v-else
						:device="item.device"
						:viewport="viewport"
						@action="(dev, a) => emit('action', dev, a)"
					/>
				</DynamicScrollerItem>
			</template>
			<template #empty>
				<ZwEmptyState />
			</template>
		</DynamicScroller>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import ZwDeviceRow from '@/components/dashboard/components/ZwDeviceRow.vue'
import ZwExpandedRow from '@/components/dashboard/components/ZwExpandedRow.vue'
import ZwEmptyState from '@/components/dashboard/components/ZwEmptyState.vue'
import {
	gridTemplateB,
	type ToggleableCol,
} from '@/components/dashboard/components/gridTemplateB'
import {
	compareDevices,
	SORTABLE_KEYS,
	type SortKey,
	type SortState,
} from './table-sort'
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChevronDownIcon,
	ICON_SIZE,
} from '@/lib/icons'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

type Grouping = 'location' | 'type' | 'all'

const TOGGLEABLE_COL_SET = new Set<ToggleableCol>([
	'transient',
	'location',
	'value',
	'power',
	'signal',
	'lastSeen',
])

type GroupHeadItem = {
	id: string
	kind: 'group-head'
	key: string
	count: number
	collapsed: boolean
}

type RowItem = { id: string; kind: 'row'; device: Device }
type ExpandedItem = { id: string; kind: 'expanded'; device: Device }
type FlatItem = GroupHeadItem | RowItem | ExpandedItem

const props = defineProps<{
	groups: [string, Device[]][]
	viewport: number
	expandedId: number | string | null
	collapsedGroups: Set<string>
	visibleCols: Set<string>
	sort: SortState
	grouping: Grouping
}>()

const emit = defineEmits<{
	expand: [Device['id']]
	toggleGroup: [string]
	sort: [SortKey]
	action: [Device, DeviceAction]
}>()

const columns = computed<ToggleableCol[]>(() => {
	let cap: ToggleableCol[]
	const w = props.viewport
	if (w >= 1024) {
		cap = ['transient', 'location', 'value', 'power', 'signal', 'lastSeen']
	} else if (w >= 768) {
		cap = ['location', 'value', 'power', 'signal']
	} else {
		cap = ['value']
	}
	return cap.filter(
		(c) =>
			!TOGGLEABLE_COL_SET.has(c) || props.visibleCols.has(c),
	)
})

const headerTemplate = computed(() =>
	gridTemplateB(props.viewport, columns.value),
)

interface HeaderCell {
	key: string
	label: string
	sortKey: SortKey | null
	sortable: boolean
	active: boolean
	rightAlign: boolean
}

const SORT_KEY_FOR_COL: Record<string, SortKey> = {
	id: 'id',
	location: 'location',
	power: 'power',
	lastSeen: 'lastSeen',
	transient: 'transient',
}

const headerCells = computed<HeaderCell[] | null>(() => {
	if (props.viewport < 600) return null
	const cells: { label: string; key: string }[] = [
		{ label: '', key: 'status' },
		{ label: '#', key: 'id' },
		{ label: 'Device', key: 'name' },
	]
	if (columns.value.includes('transient')) {
		cells.push({ label: 'Activity', key: 'transient' })
	}
	if (columns.value.includes('location')) {
		cells.push({ label: 'Location', key: 'location' })
	}
	if (columns.value.includes('value')) {
		cells.push({ label: 'State / Value', key: 'value' })
	}
	if (columns.value.includes('power')) {
		cells.push({ label: 'Power', key: 'power' })
	}
	if (columns.value.includes('signal')) {
		cells.push({ label: 'Link', key: 'signal' })
	}
	if (columns.value.includes('lastSeen')) {
		cells.push({ label: 'Last seen', key: 'lastSeen' })
	}
	cells.push({ label: '', key: 'chev' })

	return cells.map(({ label, key }) => {
		const sortKey =
			key === 'id'
				? ('id' as SortKey)
				: (SORT_KEY_FOR_COL[key] ?? null)
		const sortable = sortKey !== null && SORTABLE_KEYS.has(sortKey)
		const active = sortable && props.sort.key === sortKey
		return {
			label,
			key,
			sortKey,
			sortable,
			active,
			rightAlign: key === 'lastSeen',
		}
	})
})

const sortedGroups = computed<[string, Device[]][]>(() => {
	let arr = props.groups.map(
		([key, items]) =>
			[key, [...items].sort((a, b) => compareDevices(a, b, props.sort))] as [
				string,
				Device[],
			],
	)
	if (props.grouping === 'location' && props.sort.key === 'location') {
		const sign = props.sort.dir === 'desc' ? -1 : 1
		arr = [...arr].sort((a, b) => {
			if (a[0] === '__controller') return -1
			if (b[0] === '__controller') return 1
			const av = String(a[0]).toLowerCase()
			const bv = String(b[0]).toLowerCase()
			if (av < bv) return -1 * sign
			if (av > bv) return 1 * sign
			return 0
		})
	}
	return arr
})

const flatItems = computed<FlatItem[]>(() => {
	const out: FlatItem[] = []
	for (const [key, items] of sortedGroups.value) {
		const collapsed = props.collapsedGroups.has(key)
		out.push({
			id: `head:${key}`,
			kind: 'group-head',
			key,
			count: items.length,
			collapsed,
		})
		if (collapsed) continue
		for (const d of items) {
			out.push({ id: `row:${d.id}`, kind: 'row', device: d })
			if (props.expandedId === d.id) {
				out.push({ id: `expanded:${d.id}`, kind: 'expanded', device: d })
			}
		}
	}
	return out
})

// ── scrollbar-width compensation ─────────────────────────────────
// DynamicScroller owns the body scrollbar; the column header lives outside
// the scroller so its width otherwise drifts when the scrollbar appears.
// Measure once on mount and re-measure on resize / item-count changes.

const rootRef = ref<HTMLElement | null>(null)
const scrollerRef = ref<InstanceType<typeof DynamicScroller> | null>(null)
const scrollbarW = ref(0)

function measureScrollbar() {
	const root = rootRef.value
	if (!root) return
	const scroller = root.querySelector(
		'.zw-table__body',
	) as HTMLElement | null
	if (!scroller) return
	scrollbarW.value = scroller.offsetWidth - scroller.clientWidth
}

let ro: ResizeObserver | null = null

onMounted(() => {
	measureScrollbar()
	if (rootRef.value) {
		ro = new ResizeObserver(() => measureScrollbar())
		ro.observe(rootRef.value)
	}
})

onBeforeUnmount(() => {
	ro?.disconnect()
	ro = null
})

watch(
	() => flatItems.value.length,
	() => {
		// next tick to let the scroller size itself
		setTimeout(measureScrollbar, 0)
	},
)
</script>

<style scoped>
.zw-table {
	flex: 1;
	display: flex;
	flex-direction: column;
	background: var(--zw-bg-soft);
	overflow: hidden;
}

.zw-table__header {
	display: grid;
	column-gap: 8px;
	padding: 8px 16px;
	padding-right: calc(16px + var(--zw-table-sbw, 0px));
	border-bottom: 1px solid var(--zw-line);
	background: var(--zw-card);
	font-family: var(--zw-mono);
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: 0.6px;
	color: var(--zw-fg-soft);
	font-weight: 600;
	flex-shrink: 0;
	z-index: 2;
}

.zw-table__head-btn {
	appearance: none;
	border: none;
	cursor: pointer;
	background: transparent;
	padding: 0;
	font: inherit;
	letter-spacing: inherit;
	text-transform: inherit;
	display: inline-flex;
	align-items: center;
	gap: 4px;
	color: var(--zw-fg-soft);
	font-weight: 600;
	transition: color 0.12s;
	min-width: 0;
}

.zw-table__head-btn:hover:not(.is-active) {
	color: var(--zw-fg);
}

.zw-table__head-btn.is-active {
	color: var(--zw-accent);
	font-weight: 700;
}

.zw-table__head-btn--right {
	justify-content: flex-end;
}

.zw-table__head-static {
	min-width: 0;
}

.zw-table__head-static--right {
	text-align: right;
}

.zw-table__body {
	flex: 1;
	background: var(--zw-card);
}

.zw-table__group-head {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 16px;
	background: var(--zw-bg-soft);
	border-bottom: 1px solid var(--zw-line-soft);
	cursor: pointer;
}

.zw-table__group-chev {
	color: var(--zw-fg-soft);
	transition: transform 0.15s;
}

.zw-table__group-chev--collapsed {
	transform: rotate(-90deg);
}

.zw-table__group-name {
	font-size: 12px;
	font-weight: 600;
	color: var(--zw-fg);
}

.zw-table__group-count {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-fg-soft);
}
</style>
