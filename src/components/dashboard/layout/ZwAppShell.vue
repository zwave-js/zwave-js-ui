<template>
	<div ref="shellRef" class="zw-shell">
		<ZwSidebar
			v-if="!isMobile"
			:active="active"
			:mode="sidebarMode"
			:row-actions="rowActions"
			:show-collapse-toggle="isCompact"
			@select="onNavSelect"
			@toggle-collapse="tabletExpanded = !tabletExpanded"
			@row-action="onSidebarRowAction"
		/>

		<ZwSidebar
			v-if="isMobile"
			v-model:mobile-open="mobileSidebarOpen"
			:active="active"
			mode="mobile"
			:row-actions="rowActions"
			@select="onNavSelect"
			@row-action="onSidebarRowAction"
		/>

		<main class="zw-shell__main">
			<ZwTopbar
				:query="query"
				:viewport="viewport"
				:scope-title="scopeTitle"
				:activity-hidden="activityHidden"
				:show-menu-button="isMobile"
				@query="query = $event"
				@menu="mobileSidebarOpen = true"
				@toggle-activity="activityHidden = !activityHidden"
				@add-action="onAddAction"
			/>

			<ZwActivityStrip
				v-if="!activityHidden"
				:activities="activities"
				:viewport="viewport"
				@hide="activityHidden = true"
			/>

			<ZwDeviceListToolbar
				v-if="isDeviceListNav"
				:grouping="grouping"
				:view="view"
				:viewport="viewport"
				:visible-cols="visibleCols"
				@grouping="grouping = $event"
				@view="onViewChange"
				@update:visible-cols="(v) => (visibleCols = v as Set<string>)"
			/>

			<div class="zw-shell__body">
				<ZwCardsBody
					v-if="view === 'cards'"
					:groups="groups"
					:viewport="viewport"
					@open="onCardOpen"
					@action="onAction"
				/>
				<ZwTableBody
					v-else
					:groups="groups"
					:viewport="viewport"
					:expanded-id="expandedRowId"
					:collapsed-groups="collapsedGroups"
					:visible-cols="visibleCols"
					:sort="sort"
					:grouping="grouping"
					@expand="onRowExpand"
					@toggle-group="onToggleGroup"
					@sort="(k) => (sort = nextSort(sort, k))"
					@action="onAction"
				/>

				<ZwDeviceDrawer
					v-if="view === 'cards'"
					:device="selectedDevice"
					:viewport="viewport"
					@close="onDrawerClose"
					@action="onAction"
				/>
			</div>
		</main>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import useDashboardStore from '@/stores/dashboard'
import ZwSidebar, {
	type RowAction,
} from './ZwSidebar.vue'
import ZwTopbar from './ZwTopbar.vue'
import ZwActivityStrip from './ZwActivityStrip.vue'
import ZwDeviceListToolbar from './ZwDeviceListToolbar.vue'
import ZwCardsBody from './ZwCardsBody.vue'
import ZwTableBody from './ZwTableBody.vue'
import ZwDeviceDrawer from './ZwDeviceDrawer.vue'
import {
	DEFAULT_SORT,
	nextSort,
	type SortKey,
	type SortState,
} from './table-sort'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

type Scope = 'overview' | 'attention' | 'activity'
type Grouping = 'location' | 'type' | 'all'
type View = 'cards' | 'table'
type AddAction = 'include' | 'replace' | 'exclude'

const DEVICE_LIST_NAV: ReadonlySet<string> = new Set<Scope>([
	'overview',
	'attention',
	'activity',
])

// Non-scope nav IDs whose route segment matches the ID itself (per plan 51
// task 2). Selecting one of these dispatches via vue-router.
const ROUTABLE_NAV_IDS = new Set([
	'smart-start',
	'scenes',
	'configuration-templates',
	'mesh',
	'settings',
	'store',
	'debug',
])

const props = withDefaults(
	defineProps<{
		initialActive?: string
		initialGrouping?: Grouping
		initialView?: View
	}>(),
	{
		initialActive: 'overview',
		initialGrouping: 'location',
		initialView: 'cards',
	},
)

const emit = defineEmits<{
	action: [Device, DeviceAction]
	addAction: [AddAction]
	navigate: [string]
	sidebarRowAction: [string, string]
}>()

// ── viewport ─────────────────────────────────────────────────
// Deviates from plan 50 task 1 (which calls for window.innerWidth + resize).
// ResizeObserver on the shell root makes the layout breakpoints respect the
// shell's actual rendered width — required when the shell is embedded inside
// a fixed-width host (e.g. the showcase frame) instead of reaching the page
// edges. Behaviour is identical in production where the shell IS the window.

const shellRef = ref<HTMLElement | null>(null)
const viewport = ref(
	typeof window !== 'undefined' ? window.innerWidth : 1280,
)

let ro: ResizeObserver | null = null

onMounted(() => {
	if (shellRef.value) {
		viewport.value = shellRef.value.clientWidth
		ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				viewport.value = Math.round(entry.contentRect.width)
			}
		})
		ro.observe(shellRef.value)
	}
})

onBeforeUnmount(() => {
	ro?.disconnect()
	ro = null
})

const isMobile = computed(() => viewport.value < 760)
const isCompact = computed(
	() => viewport.value >= 760 && viewport.value < 1100,
)

// ── ui state (AppShell-owned) ────────────────────────────────

const active = ref<string>(props.initialActive)
const mobileSidebarOpen = ref(false)
const tabletExpanded = ref(false)
const activityHidden = ref(false)
const query = ref('')
const grouping = ref<Grouping>(props.initialGrouping)
const view = ref<View>(props.initialView)
const selectedId = ref<Device['id'] | null>(null)
const expandedRowId = ref<Device['id'] | null>(null)
const collapsedGroups = ref<Set<string>>(new Set())
const visibleCols = ref<Set<string>>(
	new Set(['activity', 'location', 'value', 'power', 'signal', 'lastSeen']),
)
const sort = ref<SortState>({ ...DEFAULT_SORT })
const capturing = ref(false)
const triggerEl = ref<HTMLElement | null>(null)

// Close mobile sidebar on viewport widen; collapse tabletExpanded once we
// leave the compact range (mirrors `combined-dashboard.jsx:1402-1404`).
watch(isMobile, (v) => {
	if (!v) mobileSidebarOpen.value = false
})
watch(isCompact, (v) => {
	if (!v) tabletExpanded.value = false
})

const sidebarMode = computed<'wide' | 'collapsed' | 'mobile'>(() => {
	if (isMobile.value) return 'mobile'
	if (isCompact.value && !tabletExpanded.value) return 'collapsed'
	return 'wide'
})

// ── store (plan 70 placeholder) ──────────────────────────────

const store = useDashboardStore()
const { devices, activities } = storeToRefs(store)

// ── scoped + grouped device pool ─────────────────────────────

const isDeviceListNav = computed(() => DEVICE_LIST_NAV.has(active.value))

const scopedDevices = computed<Device[]>(() => {
	let pool = devices.value
	if (active.value === 'attention') {
		pool = pool.filter((d) => d.isController || deviceNeedsAttention(d))
	} else if (active.value === 'activity') {
		pool = pool.filter((d) => (d.activity?.length ?? 0) > 0)
	}
	const q = query.value.toLowerCase().trim()
	if (q) {
		pool = pool.filter((d) =>
			[d.name, d.location, d.product, d.manufacturer, String(d.nodeId)]
				.filter(Boolean)
				.some((s) => s!.toLowerCase().includes(q)),
		)
	}
	return pool
})

function deviceNeedsAttention(d: Device): boolean {
	if (d.isController) return false
	if (d.status === 'dead') return true
	if (
		d.power.type === 'battery' &&
		typeof d.power.battery === 'number' &&
		d.power.battery < 20
	)
		return true
	if (d.interviewState && d.interviewState !== 'complete') return true
	return false
}

const groups = computed<[string, Device[]][]>(() => {
	const pool = scopedDevices.value
	if (grouping.value === 'all') {
		return [['All devices', pool]]
	}
	const map = new Map<string, Device[]>()
	for (const d of pool) {
		if (d.isController) {
			if (!map.has('__controller')) map.set('__controller', [])
			map.get('__controller')!.push(d)
			continue
		}
		const key =
			grouping.value === 'location'
				? d.location || 'No location'
				: d.archetype.label
		if (!map.has(key)) map.set(key, [])
		map.get(key)!.push(d)
	}
	// Pin controller group to the top.
	const entries: [string, Device[]][] = []
	if (map.has('__controller')) {
		entries.push(['__controller', map.get('__controller')!])
		map.delete('__controller')
	}
	for (const [k, v] of map) entries.push([k, v])
	return entries
})

// ── selected device (drawer) ─────────────────────────────────

const selectedDevice = computed(() =>
	selectedId.value === null
		? null
		: (devices.value.find((d) => d.id === selectedId.value) ?? null),
)

// ── scope title ──────────────────────────────────────────────

const scopeTitle = computed(() => {
	if (active.value === 'attention') return 'Needs attention'
	if (active.value === 'activity') return 'Activity'
	return 'Overview'
})

// ── sidebar row actions registry ─────────────────────────────

const rowActions = computed<RowAction[]>(() => [
	{
		navId: 'debug',
		id: 'capture',
		ariaLabel: capturing.value
			? 'Stop debug capture'
			: 'Start debug capture',
		icon: 'circle',
		iconActive: 'square',
		tone: 'danger',
		active: capturing.value,
	},
])

// ── handlers ─────────────────────────────────────────────────

const router = useRouter()

function onNavSelect(navId: string): void {
	if (DEVICE_LIST_NAV.has(navId)) {
		active.value = navId as Scope
		selectedId.value = null
		expandedRowId.value = null
		return
	}
	if (ROUTABLE_NAV_IDS.has(navId)) {
		emit('navigate', navId)
		// Nav IDs match route segments, so `/${navId}` is the destination.
		void router.push(`/${navId}`)
	}
}

function onSidebarRowAction(navId: string, actionId: string): void {
	emit('sidebarRowAction', navId, actionId)
	if (navId === 'debug' && actionId === 'capture') {
		capturing.value = !capturing.value
	}
}

function onAddAction(a: AddAction): void {
	emit('addAction', a)
}

function onAction(device: Device, action: DeviceAction): void {
	emit('action', device, action)
}

function onCardOpen(d: Device, e?: MouseEvent): void {
	// Save the trigger so focus can return to it on close.
	if (e?.currentTarget instanceof HTMLElement) {
		triggerEl.value = e.currentTarget
	}
	selectedId.value = d.id
}

function onRowExpand(id: Device['id']): void {
	expandedRowId.value = expandedRowId.value === id ? null : id
}

function onToggleGroup(key: string): void {
	const next = new Set(collapsedGroups.value)
	if (next.has(key)) next.delete(key)
	else next.add(key)
	collapsedGroups.value = next
}

function onViewChange(v: View): void {
	view.value = v
	// View switch drops the current selection per plan 50 task 6.
	selectedId.value = null
	expandedRowId.value = null
}

function onDrawerClose(): void {
	selectedId.value = null
	if (triggerEl.value) {
		triggerEl.value.focus()
		triggerEl.value = null
	}
}
</script>

<style scoped>
.zw-shell {
	height: 100%;
	display: flex;
	background: var(--zw-bg);
	color: var(--zw-fg);
	font-family: var(--zw-font);
	overflow: hidden;
	position: relative;
}

.zw-shell__main {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;
	position: relative;
}

.zw-shell__body {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;
	position: relative;
}
</style>
