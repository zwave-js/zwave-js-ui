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
					<span>{{ cell.label || (cell.key === 'activity' ? 'Activity' : cell.key) }}</span>
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

		<div
			ref="bodyRef"
			class="zw-table__body"
			@scroll.passive="onScroll"
		>
			<ZwEmptyState v-if="layoutItems.length === 0" />
			<div
				v-else
				class="zw-table__inner"
				:style="{ height: totalHeight + 'px' }"
			>
				<!-- Virtualized: rows and group-heads. Reused across scroll. -->
				<template
					v-for="item in visibleItems"
					:key="item.id"
				>
					<div
						v-if="item.kind === 'group-head'"
						class="zw-table__group-head"
						:style="absStyle(item)"
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
						v-else
						:device="item.device"
						:expanded="expandedId === item.device.id"
						:columns="columns as ToggleableCol[]"
						:viewport="viewport"
						:style="absStyle(item)"
						@expand="(id) => emit('expand', id)"
						@action="(dev, a) => emit('action', dev, a)"
					/>
				</template>

				<!-- Persistent: the expanded body lives outside the virtualized
				     loop so scrolling it out of view (or row-height churn from
				     a tab switch) never tears it down. -->
				<div
					v-if="expandedDevice && expandedBodyTop != null"
					ref="expandedHostRef"
					class="zw-table__expanded-host"
					:style="{ top: expandedBodyTop + 'px' }"
				>
					<ZwExpandedRow
						:device="expandedDevice"
						:viewport="viewport"
						@action="(dev, a) => emit('action', dev, a)"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ZwDeviceRow from '@/components/dashboard/components/ZwDeviceRow.vue'
import ZwExpandedRow from '@/components/dashboard/components/ZwExpandedRow.vue'
import ZwEmptyState from '@/components/dashboard/components/ZwEmptyState.vue'
import {
	deviceRowGrid,
	type ToggleableCol,
} from '@/components/dashboard/components/deviceRowGrid'
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
	'activity',
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
type FlatItem = GroupHeadItem | RowItem
type LayoutItem = FlatItem & { top: number; height: number }

// Fixed sizes — must match the row/group-head CSS below. Keeping them
// constants (instead of measuring) avoids the resize-feedback loop that
// killed the DynamicScroller approach.
const ROW_HEIGHT = 42
const GROUP_HEAD_HEIGHT = 36
const SCROLL_BUFFER = 240

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
		cap = ['activity', 'location', 'value', 'power', 'signal', 'lastSeen']
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
	deviceRowGrid(props.viewport, columns.value),
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
	activity: 'activity',
}

const headerCells = computed<HeaderCell[] | null>(() => {
	if (props.viewport < 600) return null
	const cells: { label: string; key: string }[] = [
		{ label: '', key: 'status' },
		{ label: '#', key: 'id' },
		{ label: 'Device', key: 'name' },
	]
	if (columns.value.includes('activity')) {
		cells.push({ label: 'Activity', key: 'activity' })
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
		}
	}
	return out
})

const expandedDevice = computed<Device | null>(() => {
	if (props.expandedId == null) return null
	for (const item of flatItems.value) {
		if (item.kind === 'row' && item.device.id === props.expandedId) {
			return item.device
		}
	}
	return null
})

// ── manual virtualization ─────────────────────────────────────────
// vue-virtual-scroller recycled DOM views across items, which tore
// the expanded body's component state down on every tab switch.
// We render only the rows in/near the viewport; the expanded body
// lives outside this loop so it survives both scroll and row-height
// churn.

const bodyRef = ref<HTMLElement | null>(null)
const expandedHostRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)
const expandedBodyHeight = ref(0)

const layout = computed<{ items: LayoutItem[]; total: number }>(() => {
	const out: LayoutItem[] = []
	let top = 0
	const expanded = props.expandedId
	for (const item of flatItems.value) {
		const height =
			item.kind === 'group-head' ? GROUP_HEAD_HEIGHT : ROW_HEIGHT
		out.push({ ...item, top, height } as LayoutItem)
		top += height
		// Reserve space for the expanded body right after the row
		// it belongs to. Using a layout-only gap (rather than a
		// separate flatItems entry) lets us position the persistent
		// expanded body without it ever entering the virtualized
		// loop.
		if (item.kind === 'row' && expanded != null && item.device.id === expanded) {
			top += expandedBodyHeight.value
		}
	}
	return { items: out, total: top }
})

const layoutItems = computed(() => layout.value.items)
const totalHeight = computed(() => layout.value.total)

const visibleItems = computed<LayoutItem[]>(() => {
	const top = scrollTop.value - SCROLL_BUFFER
	const bottom = scrollTop.value + viewportHeight.value + SCROLL_BUFFER
	const arr = layoutItems.value
	// Binary-ish narrow: items are top-sorted, so we could bisect, but
	// a linear pass is plenty fast for 4000 entries and avoids a
	// pre-built index that has to stay in sync.
	const out: LayoutItem[] = []
	for (const it of arr) {
		if (it.top + it.height < top) continue
		if (it.top > bottom) break
		out.push(it)
	}
	return out
})

const expandedBodyTop = computed<number | null>(() => {
	if (props.expandedId == null) return null
	for (const it of layoutItems.value) {
		if (it.kind === 'row' && it.device.id === props.expandedId) {
			return it.top + ROW_HEIGHT
		}
	}
	return null
})

function absStyle(item: LayoutItem) {
	return {
		position: 'absolute' as const,
		top: `${item.top}px`,
		left: 0,
		right: 0,
		height: `${item.height}px`,
	}
}

function onScroll(e: Event) {
	const t = e.target as HTMLElement
	scrollTop.value = t.scrollTop
}

// ── scrollbar-width compensation ─────────────────────────────────
// The body owns its own scrollbar; the column header lives outside
// it, so its width otherwise drifts when the scrollbar appears.

const rootRef = ref<HTMLElement | null>(null)
const scrollbarW = ref(0)

function measureScrollbar() {
	const body = bodyRef.value
	if (!body) return
	scrollbarW.value = body.offsetWidth - body.clientWidth
}

let viewportObserver: ResizeObserver | null = null
let expandedObserver: ResizeObserver | null = null

onMounted(() => {
	if (bodyRef.value) {
		viewportHeight.value = bodyRef.value.clientHeight
		viewportObserver = new ResizeObserver(() => {
			if (!bodyRef.value) return
			viewportHeight.value = bodyRef.value.clientHeight
			measureScrollbar()
		})
		viewportObserver.observe(bodyRef.value)
		measureScrollbar()
	}
})

// Track the persistent expanded body's height so we reserve the
// right amount of space in the layout.
watch(expandedHostRef, (el, _old, onCleanup) => {
	if (expandedObserver) {
		expandedObserver.disconnect()
		expandedObserver = null
	}
	if (!el) {
		expandedBodyHeight.value = 0
		return
	}
	expandedBodyHeight.value = el.offsetHeight
	expandedObserver = new ResizeObserver((entries) => {
		const h = entries[0]?.contentRect.height
		if (typeof h === 'number') expandedBodyHeight.value = h
	})
	expandedObserver.observe(el)
	onCleanup(() => {
		expandedObserver?.disconnect()
		expandedObserver = null
	})
})

onBeforeUnmount(() => {
	viewportObserver?.disconnect()
	viewportObserver = null
	expandedObserver?.disconnect()
	expandedObserver = null
})
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
	overflow-y: auto;
	min-height: 0;
	position: relative;
}

.zw-table__inner {
	position: relative;
	width: 100%;
}

.zw-table__expanded-host {
	position: absolute;
	left: 0;
	right: 0;
}

.zw-table__group-head {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 0 16px;
	background: var(--zw-bg-soft);
	border-bottom: 1px solid var(--zw-line-soft);
	cursor: pointer;
	box-sizing: border-box;
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
