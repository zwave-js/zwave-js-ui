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
					<span>{{ cell.label || cell.key }}</span>
					<component
						:is="
							cell.active && sort.dir === 'desc'
								? ArrowDownIcon
								: ArrowUpIcon
						"
						:size="ICON_SIZE.caret"
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

		<div ref="bodyRef" class="zw-table__body" @scroll.passive="onScroll">
			<ZwEmptyState v-if="layoutItems.length === 0" />
			<div
				v-else
				class="zw-table__inner"
				:style="{ height: totalHeight + 'px' }"
			>
				<!-- Virtualized rows and group-heads. -->
				<template v-for="item in visibleItems" :key="item.id">
					<div
						v-if="item.kind === 'group-head'"
						class="zw-table__group-head"
						:style="absStyle(item)"
						@click="emit('toggleGroup', item.key)"
					>
						<ChevronDownIcon
							:size="ICON_SIZE.caret"
							class="zw-table__group-chev"
							:class="{
								'zw-table__group-chev--collapsed':
									item.collapsed,
							}"
						/>
						<span class="zw-table__group-name">
							{{
								item.key === CONTROLLER_KEY
									? 'Controller'
									: item.key
							}}
						</span>
						<span
							v-if="item.key !== CONTROLLER_KEY"
							class="zw-table__group-count"
						>
							{{ item.count }}
						</span>
					</div>
					<!-- The expanded device's summary row is rendered by the
					     sticky overlay below, not here, so it can pin. -->
					<ZwDeviceRow
						v-else-if="item.device.nodeId !== expandedId"
						:device="item.device"
						:expanded="false"
						:columns="columns as ToggleableCol[]"
						:viewport="viewport"
						:style="absStyle(item)"
						@open="(dev) => emit('open', dev)"
						@action="(dev, a) => emit('action', dev, a)"
					/>
				</template>

				<!-- The expanded body lives outside the virtualized loop so it
				     keeps its state across scroll and row-height changes. -->
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

				<!-- Sticky summary row — keeps the expanded device pinned
				     just beneath the group header while its detail scrolls. -->
				<div
					v-if="expandedDevice && stickyRowTop != null"
					class="zw-table__sticky-row"
					:style="{ top: stickyRowTop + 'px' }"
				>
					<ZwDeviceRow
						:device="expandedDevice"
						:expanded="true"
						:columns="columns as ToggleableCol[]"
						:viewport="viewport"
						@open="(dev) => emit('open', dev)"
						@action="(dev, a) => emit('action', dev, a)"
					/>
				</div>

				<!-- Sticky group header — pinned to the top of the scroll
				     viewport as the active group scrolls. -->
				<div
					v-if="stickyGroup"
					class="zw-table__group-head zw-table__group-head--sticky"
					:style="{
						top: stickyGroup.top + 'px',
						height: GROUP_HEAD_HEIGHT + 'px',
					}"
					@click="emit('toggleGroup', stickyGroup.key)"
				>
					<ChevronDownIcon
						:size="ICON_SIZE.caret"
						class="zw-table__group-chev"
						:class="{
							'zw-table__group-chev--collapsed':
								stickyGroup.collapsed,
						}"
					/>
					<span class="zw-table__group-name">
						{{
							stickyGroup.key === CONTROLLER_KEY
								? 'Controller'
								: stickyGroup.key
						}}
					</span>
					<span
						v-if="stickyGroup.key !== CONTROLLER_KEY"
						class="zw-table__group-count"
					>
						{{ stickyGroup.count }}
					</span>
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
	TOGGLEABLE_COLS,
	type ToggleableCol,
} from '@/components/dashboard/components/deviceRowGrid'
import { SORTABLE_KEYS, type SortKey, type SortState } from './table-sort'
import { CONTROLLER_KEY } from '@/lib/deviceFilter'
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChevronDownIcon,
	ICON_SIZE,
} from '@/lib/icons'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

// Every toggleable column id, from deviceRowGrid.
const ALL_COLS: ToggleableCol[] = TOGGLEABLE_COLS.map((c) => c.id)
const TOGGLEABLE_COL_SET = new Set<ToggleableCol>(ALL_COLS)

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

// Fixed sizes — must match the row/group-head CSS below. Constants (not
// measured) avoid a resize-feedback loop.
const ROW_HEIGHT = 42
const GROUP_HEAD_HEIGHT = 36
const SCROLL_BUFFER = 240

const props = defineProps<{
	groups: [string, Device[]][]
	viewport: number
	expandedId: number | null
	collapsedGroups: Set<string>
	visibleCols: readonly string[]
	sort: SortState
}>()

const emit = defineEmits<{
	open: [Device]
	toggleGroup: [string]
	sort: [SortKey]
	action: [Device, DeviceAction]
}>()

// A Set so the per-row column check below is O(1); rebuilt when
// visibleCols changes.
const visibleColsSet = computed(() => new Set(props.visibleCols))

const columns = computed<ToggleableCol[]>(() => {
	let cap: ToggleableCol[]
	const w = props.viewport
	if (w >= 1024) {
		cap = ALL_COLS
	} else if (w >= 768) {
		cap = ['location', 'value', 'power', 'signal']
	} else {
		cap = ['value']
	}
	return cap.filter(
		(c) => !TOGGLEABLE_COL_SET.has(c) || visibleColsSet.value.has(c),
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
	// Lead/trailing cells frame the row; the optional columns and their
	// labels come straight from TOGGLEABLE_COLS (the single source of truth).
	const cells: { label: string; key: string }[] = [
		{ label: '', key: 'status' },
		{ label: '#', key: 'id' },
		{ label: 'Device', key: 'name' },
		...TOGGLEABLE_COLS.filter((c) => columns.value.includes(c.id)).map(
			(c) => ({ label: c.label, key: c.id }),
		),
		{ label: '', key: 'chev' },
	]

	return cells.map(({ label, key }) => {
		const sortKey =
			key === 'id' ? ('id' as SortKey) : (SORT_KEY_FOR_COL[key] ?? null)
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

// `props.groups` arrives already scoped, grouped and sorted by
// `buildGroups` (see ZwAppShell); the cards body consumes it the same way.
const flatItems = computed<FlatItem[]>(() => {
	const out: FlatItem[] = []
	for (const [key, items] of props.groups) {
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
			out.push({ id: `row:${d.nodeId}`, kind: 'row', device: d })
		}
	}
	return out
})

const expandedDevice = computed<Device | null>(() => {
	if (props.expandedId == null) return null
	for (const item of flatItems.value) {
		if (item.kind === 'row' && item.device.nodeId === props.expandedId) {
			return item.device
		}
	}
	return null
})

// ── manual virtualization ─────────────────────────────────────────
// Render only the rows in or near the viewport. The expanded body lives
// outside this loop so its state survives scroll and row-height changes.

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
		// Reserve space for the expanded body right after its row, as
		// a layout-only gap so the body never enters the virtualized
		// loop.
		if (
			item.kind === 'row' &&
			expanded != null &&
			item.device.nodeId === expanded
		) {
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
	// Linear scan — fast enough for a few thousand top-sorted entries.
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
		if (it.kind === 'row' && it.device.nodeId === props.expandedId) {
			return it.top + ROW_HEIGHT
		}
	}
	return null
})

// ── sticky group header + expanded summary row ─────────────────────
// Absolute positioning (the virtualization) defeats native
// `position: sticky`, so we re-create it: derive each group's vertical
// span, then render the active group's header — and, while a row is
// expanded, its summary row just below — as overlays whose `top` is
// pinned to the scroll viewport. The expanded row is dropped from the
// normal loop (see template) so the overlay is its sole render.

interface GroupSpan {
	key: string
	count: number
	collapsed: boolean
	headTop: number
	endTop: number
}

const groupSpans = computed<GroupSpan[]>(() => {
	const spans: GroupSpan[] = []
	for (const it of layoutItems.value) {
		if (it.kind !== 'group-head') continue
		if (spans.length) spans[spans.length - 1].endTop = it.top
		spans.push({
			key: it.key,
			count: it.count,
			collapsed: it.collapsed,
			headTop: it.top,
			endTop: totalHeight.value,
		})
	}
	return spans
})

// The group whose span contains the current scroll offset, with its
// header `top` clamped so the next group pushes it up at the boundary.
const stickyGroup = computed(() => {
	const st = scrollTop.value
	for (const g of groupSpans.value) {
		if (st >= g.headTop && st < g.endTop) {
			return { ...g, top: Math.min(st, g.endTop - GROUP_HEAD_HEIGHT) }
		}
	}
	return null
})

// Top for the pinned summary row: just under the group header, clamped
// to the expanded region so it rides up out of view past the panel.
const stickyRowTop = computed<number | null>(() => {
	if (expandedBodyTop.value == null) return null
	const rowTop = expandedBodyTop.value - ROW_HEIGHT
	const regionBottom = expandedBodyTop.value + expandedBodyHeight.value
	return Math.min(
		Math.max(scrollTop.value + GROUP_HEAD_HEIGHT, rowTop),
		regionBottom - ROW_HEIGHT,
	)
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

/* Sticky overlays — opaque backgrounds (so scrolling content doesn't
   bleed through) and a hair of lift. The group header sits above the
   summary row, which sits above the detail panel. */
.zw-table__group-head--sticky {
	position: absolute;
	left: 0;
	right: 0;
	z-index: 3;
	box-shadow: 0 2px 4px rgba(var(--v0-on-surface), 0.06);
}

.zw-table__sticky-row {
	position: absolute;
	left: 0;
	right: 0;
	z-index: 2;
	box-shadow: 0 2px 5px rgba(var(--v0-on-surface), 0.06);
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
