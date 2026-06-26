<template>
	<div ref="shellRef" class="zw-shell">
		<ZwSidebar
			v-if="!isMobile"
			:active="active"
			:mode="sidebarMode"
			:row-actions="rowActions"
			:show-collapse-toggle="true"
			@select="onNavSelect"
			@toggle-collapse="onToggleCollapse"
			@row-action="onSidebarRowAction"
			@restart="emit('restart')"
			@check-updates="emit('checkUpdates')"
		/>

		<ZwSidebar
			v-if="isMobile"
			v-model:mobile-open="mobileSidebarOpen"
			:active="active"
			mode="mobile"
			:row-actions="rowActions"
			@select="onNavSelect"
			@row-action="onSidebarRowAction"
			@restart="emit('restart')"
			@check-updates="emit('checkUpdates')"
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
				@update:visible-cols="(v) => (visibleCols = v)"
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
					@open="onRowOpen"
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
import useBaseStore from '@/stores/base'
import ZwSidebar, { type RowAction } from './ZwSidebar.vue'
import ZwTopbar from './ZwTopbar.vue'
import ZwActivityStrip from './ZwActivityStrip.vue'
import ZwDeviceListToolbar from './ZwDeviceListToolbar.vue'
import ZwCardsBody from './ZwCardsBody.vue'
import ZwTableBody from './ZwTableBody.vue'
import ZwDeviceDrawer from './ZwDeviceDrawer.vue'
import {
	buildGroups,
	nextSort,
	type SortKey,
	type SortState,
} from '@/lib/deviceFilter'
import type { Device, DeviceAction } from '@/lib/dashboard-types'
import {
	flushSave,
	load as loadPrefs,
	scheduleSave,
	type DashboardPrefs,
} from '@/lib/dashboardPrefs'

type Scope = 'overview' | 'attention' | 'activity'
type Grouping = 'location' | 'type' | 'all'
type View = 'cards' | 'table'
type AddAction = 'include' | 'replace-failed' | 'exclude'

const DEVICE_LIST_NAV: ReadonlySet<string> = new Set<Scope>([
	'overview',
	'attention',
	'activity',
])

// Non-scope nav IDs whose route segment matches the ID itself; selecting
// one dispatches via vue-router.
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
	restart: []
	checkUpdates: []
	// `true` to start the debug capture, `false` to finish it.
	debugCapture: [boolean]
}>()

// ── viewport ─────────────────────────────────────────────────
// A ResizeObserver on the shell root drives the layout breakpoints off the
// shell's actual rendered width rather than the window width, so it stays
// correct even when embedded in a fixed-width host.

const shellRef = ref<HTMLElement | null>(null)
const viewport = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)

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
const isCompact = computed(() => viewport.value >= 760 && viewport.value < 1100)

// ── ui state (AppShell-owned) ────────────────────────────────
//
// Load persisted prefs synchronously before first render so saved values
// don't flash in after the defaults. `query`, `selectedId`,
// `expandedRowId`, and `mobileSidebarOpen` stay ephemeral.
const persisted = loadPrefs()

const active = ref<string>(persisted.scope ?? props.initialActive)
const mobileSidebarOpen = ref(false)
// Manual override of the width-derived sidebar mode. Intentionally NOT
// persisted: collapse/expand is a per-session choice that resets to the
// viewport-appropriate default on reload, so it's absent from DashboardPrefs
// and from the persistence watcher below.
const sidebarState = ref<'collapsed' | 'wide' | null>(null)
const activityHidden = ref(persisted.activityHidden)
const query = ref('')
const grouping = ref<Grouping>(persisted.grouping ?? props.initialGrouping)
const view = ref<View>(persisted.view ?? props.initialView)
const selectedId = ref<number | null>(null)
const expandedRowId = ref<number | null>(null)
const collapsedGroups = ref<Set<string>>(new Set(persisted.collapsedGroups))
const visibleCols = ref<string[]>([...persisted.visibleCols])
const sort = ref<SortState>({ ...(persisted.sort as SortState) })
const triggerEl = ref<HTMLElement | null>(null)

// Close mobile sidebar on viewport widen.
watch(isMobile, (v) => {
	if (!v) mobileSidebarOpen.value = false
})

// ── persistence ──────────────────────────────────────────────
// Snapshot the persistable slice once so the debounced writer and the
// unmount flush share it.
function snapshotPrefs(): DashboardPrefs {
	return {
		scope: active.value as DashboardPrefs['scope'],
		grouping: grouping.value,
		view: view.value,
		sort: sort.value,
		visibleCols: [...visibleCols.value],
		collapsedGroups: Array.from(collapsedGroups.value),
		activityHidden: activityHidden.value,
	}
}

watch(
	[
		active,
		grouping,
		view,
		sort,
		visibleCols,
		collapsedGroups,
		activityHidden,
	],
	() => {
		scheduleSave(snapshotPrefs())
	},
	{ deep: true },
)

onBeforeUnmount(() => {
	flushSave(snapshotPrefs())
})

const sidebarMode = computed<'wide' | 'collapsed' | 'mobile'>(() => {
	if (isMobile.value) return 'mobile'
	if (sidebarState.value) return sidebarState.value
	return isCompact.value ? 'collapsed' : 'wide'
})

function onToggleCollapse(): void {
	sidebarState.value = sidebarMode.value === 'wide' ? 'collapsed' : 'wide'
}

// ── store ────────────────────────────────────────────────────

const store = useDashboardStore()
const baseStore = useBaseStore()
const { devices, activities } = storeToRefs(store)

// Reflects the live debug-capture session (base store), so the sidebar
// toggle stays in sync with captures started elsewhere (e.g. the topbar).
const capturing = computed(() => baseStore.debugCaptureActive)

// ── scoped + grouped device pool ─────────────────────────────

const isDeviceListNav = computed(() => DEVICE_LIST_NAV.has(active.value))

// Debounce the search input ~100 ms so each keystroke doesn't run the
// full filter pipeline; the input atom is uncontrolled, so the debounce
// lives here.
const debouncedQuery = ref('')
let queryTimer: ReturnType<typeof setTimeout> | null = null
watch(query, (v) => {
	if (queryTimer) clearTimeout(queryTimer)
	queryTimer = setTimeout(() => {
		debouncedQuery.value = v
	}, 100)
})
onBeforeUnmount(() => {
	if (queryTimer) clearTimeout(queryTimer)
})

const groups = computed<[string, Device[]][]>(() =>
	buildGroups(devices.value, {
		scope: active.value as 'overview' | 'attention' | 'activity',
		grouping: grouping.value,
		query: debouncedQuery.value,
		sort: sort.value,
	}),
)

// ── selected device (drawer) ─────────────────────────────────

const selectedDevice = computed(() =>
	selectedId.value === null
		? null
		: (devices.value.find((d) => d.nodeId === selectedId.value) ?? null),
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
		icon: 'play',
		iconActive: 'stop',
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
		emit('debugCapture', !capturing.value)
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
	selectedId.value = d.nodeId
}

function onRowOpen(dev: Device): void {
	// Table view shows details inline: toggle this row's expansion.
	expandedRowId.value = expandedRowId.value === dev.nodeId ? null : dev.nodeId
}

function onToggleGroup(key: string): void {
	const next = new Set(collapsedGroups.value)
	if (next.has(key)) next.delete(key)
	else next.add(key)
	collapsedGroups.value = next
}

function onViewChange(v: View): void {
	view.value = v
	// Switching view drops the current selection.
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
