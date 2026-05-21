<template>
	<div class="showcase">
		<header class="showcase__head">
			<h1>Dashboard rework — atoms &amp; components</h1>
			<p class="showcase__lede">
				Temporary review surface for plans 00–40. Layout (50-58) and
				device-projection (70-76) plans haven't landed yet, so the data
				below is local mock data and nothing here talks to the socket.
			</p>
			<nav class="showcase__nav">
				<a href="#atoms">Atoms</a>
				<a href="#components">Components</a>
				<a href="#cards">DeviceCard variants</a>
				<a href="#rows">DeviceRow variants</a>
				<a href="#drawer">Drawer / Expanded</a>
				<a href="#layout">Layout</a>
			</nav>
		</header>

		<!-- ───────── ATOMS ───────── -->
		<section id="atoms" class="showcase__section">
			<h2>Atoms</h2>

			<div class="block">
				<h3>ZwPill — 7 tones × 2 sizes</h3>
				<div class="row">
					<ZwPill v-for="t in PILL_TONES" :key="`p-md-${t}`" :tone="t">
						{{ t }}
					</ZwPill>
				</div>
				<div class="row">
					<ZwPill
						v-for="t in PILL_TONES"
						:key="`p-sm-${t}`"
						:tone="t"
						size="sm"
					>
						{{ t }}
					</ZwPill>
				</div>
				<div class="row">
					<ZwPill tone="accent" size="sm">
						<DownloadIcon :size="ICON_SIZE.pill" /> Update
					</ZwPill>
					<ZwPill tone="warn" size="sm">
						<SignalLowIcon :size="ICON_SIZE.pill" /> Weak signal
					</ZwPill>
					<ZwPill tone="asleep" size="sm">
						<MoonIcon :size="ICON_SIZE.pill" /> Asleep
					</ZwPill>
				</div>
			</div>

			<div class="block">
				<h3>ZwChip — 6 tones</h3>
				<div class="row">
					<ZwChip v-for="t in CHIP_TONES" :key="t" :tone="t">
						{{ t.toUpperCase() }}
					</ZwChip>
				</div>
				<div class="row">
					<ZwChip tone="neutral">ON</ZwChip>
					<ZwChip tone="neutral">OFF</ZwChip>
					<ZwChip tone="ok">LOCKED</ZwChip>
					<ZwChip tone="warn">UNLOCKED</ZwChip>
					<ZwChip tone="danger">DEAD</ZwChip>
					<ZwChip tone="warn">
						<DownloadIcon :size="ICON_SIZE.chip" /> UPDATE
					</ZwChip>
				</div>
			</div>

			<div class="block">
				<h3>ZwStatusDot — 5 statuses</h3>
				<div class="row dot-row">
					<span v-for="s in STATUSES" :key="s" class="dot-cell">
						<ZwStatusDot :status="s" />
						<span>{{ s }}</span>
					</span>
				</div>
			</div>

			<div class="block">
				<h3>ZwBatteryMini — color thresholds</h3>
				<div class="row">
					<ZwBatteryMini :pct="92" />
					<ZwBatteryMini :pct="40" />
					<ZwBatteryMini :pct="22" />
					<ZwBatteryMini :pct="9" />
					<ZwBatteryMini :pct="1" />
					<span class="muted">(null → renders nothing)</span>
					<ZwBatteryMini :pct="null" />
				</div>
			</div>

			<div class="block">
				<h3>ZwToggle — md &amp; sm</h3>
				<div class="row">
					<ZwToggle v-model="toggleA" />
					<ZwToggle v-model="toggleA" size="sm" />
					<ZwToggle :model-value="false" disabled />
					<ZwToggle :model-value="true" disabled />
					<span class="muted">value: {{ toggleA }}</span>
				</div>
			</div>

			<div class="block">
				<h3>ZwSlider</h3>
				<div class="row col">
					<ZwSlider v-model="sliderVal" style="width: 360px" />
					<span class="muted">value: {{ sliderVal }}%</span>
				</div>
			</div>

			<div class="block">
				<h3>ZwSegmented — pill-pop selectors</h3>
				<div class="row col">
					<ZwSegmented
						v-model="groupSel"
						:options="GROUP_OPTIONS"
					/>
					<ZwSegmented v-model="viewSel" :options="VIEW_OPTIONS" />
					<ZwSegmented v-model="viewSel" :options="VIEW_OPTIONS" compact />
				</div>
			</div>

			<div class="block">
				<h3>ZwSearchInput</h3>
				<div class="row col">
					<ZwSearchInput
						v-model="searchVal"
						placeholder="Search devices…"
						aria-label="Search devices"
						style="max-width: 360px"
					/>
					<span class="muted">value: {{ searchVal || '∅' }}</span>
				</div>
			</div>

			<div class="block">
				<h3>ZwUpdateNotifier — wide &amp; compact</h3>
				<div class="row">
					<ZwUpdateNotifier current="11.17.0" available="11.18.1" />
					<ZwUpdateNotifier
						current="11.17.0"
						available="11.18.1"
						compact
					/>
				</div>
			</div>

			<div class="block">
				<h3>ZwTransientReadout — table &amp; card variants</h3>
				<div class="row col">
					<div class="row">
						<ZwTransientReadout :transient="TRANSIENTS.ota" />
						<ZwTransientReadout :transient="TRANSIENTS.rebuild" />
						<ZwTransientReadout :transient="TRANSIENTS.interview" />
					</div>
					<div
						style="
							background: var(--zw-card);
							border: 1px solid var(--zw-line);
							border-radius: 4px;
							padding: 12px;
							width: 280px;
						"
					>
						<ZwTransientReadout
							variant="card"
							:transient="TRANSIENTS.ota"
						/>
					</div>
				</div>
			</div>

			<div class="block">
				<h3>ZwButton — 5 variants</h3>
				<div class="row">
					<ZwButton variant="primary">
						<template #icon><AddIcon :size="ICON_SIZE.button" /></template>
						Add device
					</ZwButton>
					<ZwButton variant="outline">Cancel</ZwButton>
					<ZwButton variant="destructive">Remove</ZwButton>
					<ZwButton variant="ghost">
						<template #icon><MoreIcon :size="ICON_SIZE.button" /></template>
					</ZwButton>
					<ZwButton variant="mono-outline">Interview</ZwButton>
					<ZwButton variant="primary" size="sm">Small</ZwButton>
					<ZwButton variant="primary" disabled>Disabled</ZwButton>
				</div>
			</div>

			<div class="block">
				<h3>ZwToggleMenu — generic multi-select</h3>
				<div class="row">
					<ZwToggleMenu
						v-model="toggleMenuVal"
						:options="TOGGLE_MENU_OPTIONS"
						trigger-label="Archetypes"
						header="Toggle archetypes"
						:badge-count="toggleMenuVal.length"
					/>
					<span class="muted">
						selected: {{ toggleMenuVal.join(', ') || '∅' }}
					</span>
				</div>
			</div>
		</section>

		<!-- ───────── COMPONENTS ───────── -->
		<section id="components" class="showcase__section">
			<h2>Components</h2>

			<div class="block">
				<h3>ZwPrimaryDisplay — 7 renderers</h3>
				<div class="primary-grid">
					<div
						v-for="d in primaryDevices"
						:key="d.id"
						class="primary-cell"
					>
						<div class="primary-cell__label">
							{{ d.primaryValue?.type ?? 'controller' }}
						</div>
						<ZwPrimaryDisplay
							:device="d"
							@action="onAction"
						/>
					</div>
				</div>
				<div class="muted">
					Last action: <code>{{ lastAction }}</code>
				</div>
			</div>

			<div class="block">
				<h3>ZwPropTable</h3>
				<ZwPropTable :rows="SAMPLE_PROPS" style="max-width: 420px" />
			</div>

			<div class="block">
				<h3>ZwSecurityPanel</h3>
				<div class="row">
					<div style="width: 240px">
						<ZwSecurityPanel :device="batteryDevice" />
					</div>
					<div style="width: 240px">
						<ZwSecurityPanel :device="controller" />
					</div>
				</div>
			</div>

			<div class="block">
				<h3>ZwStatsCard</h3>
				<div class="row" style="gap: 12px; align-items: flex-start">
					<div style="flex: 1; min-width: 280px">
						<ZwStatsCard
							title="Communication"
							:items="[
								{ label: 'CAN', value: controller.commStats?.can ?? 0 },
								{ label: 'NAK', value: controller.commStats?.nak ?? 0 },
								{
									label: 'Timeout ACK',
									value: controller.commStats?.timeoutACK ?? 0,
								},
								{
									label: 'Timeout Response',
									value: controller.commStats?.timeoutResponse ?? 0,
								},
								{
									label: 'Timeout Callback',
									value: controller.commStats?.timeoutCallback ?? 0,
								},
							]"
						/>
					</div>
					<div style="flex: 1; min-width: 280px">
						<ZwStatsCard
							title="Messages"
							:items="[
								{ label: 'TX', value: controller.commStats?.messagesTX ?? 0 },
								{ label: 'RX', value: controller.commStats?.messagesRX ?? 0 },
								{
									label: 'Dropped TX',
									value: controller.commStats?.messagesDroppedTX ?? 0,
								},
								{
									label: 'Dropped RX',
									value: controller.commStats?.messagesDroppedRX ?? 0,
								},
							]"
						/>
					</div>
				</div>
			</div>

			<div class="block">
				<h3>ZwColumnsMenu (wraps ZwToggleMenu)</h3>
				<div class="row">
					<ZwColumnsMenu v-model="columns" />
					<span class="muted">
						visible: {{ columns.join(', ') || '∅' }}
					</span>
				</div>
			</div>

			<div class="block">
				<h3>ZwAddDeviceSplitButton — face = include, chevron = menu</h3>
				<div class="row">
					<ZwAddDeviceSplitButton wide @action="onAddAction" />
					<ZwAddDeviceSplitButton @action="onAddAction" />
					<ZwAddDeviceSplitButton compact @action="onAddAction" />
					<span class="muted">
						last add action: <code>{{ lastAddAction || '—' }}</code>
					</span>
				</div>
			</div>
		</section>

		<!-- ───────── CARDS ───────── -->
		<section id="cards" class="showcase__section">
			<h2>DeviceCard — sample grid</h2>
			<p class="muted">Click any card to open the drawer (below).</p>
			<div class="card-grid">
				<ZwDeviceCard
					v-for="d in devices"
					:key="d.id"
					:device="d"
					@open="onOpen"
					@action="onAction"
				/>
			</div>
		</section>

		<!-- ───────── ROWS ───────── -->
		<section id="rows" class="showcase__section">
			<h2>DeviceRow — table view</h2>
			<p class="muted">
				Click any row to expand its inline node-details body.
			</p>
			<div class="table">
				<template v-for="d in devices" :key="d.id">
					<ZwDeviceRow
						:device="d"
						:expanded="expandedId === d.id"
						:columns="['transient', 'location', 'value', 'power', 'signal', 'lastSeen']"
						:viewport="viewport"
						@expand="onExpand"
						@action="onAction"
					/>
					<ZwExpandedRow
						v-if="expandedId === d.id"
						:device="d"
						:viewport="viewport"
						@action="onAction"
					/>
				</template>
			</div>
		</section>

		<!-- ───────── LAYOUT ───────── -->
		<section id="layout" class="showcase__section">
			<h2>Layout pieces</h2>

			<div class="block">
				<h3>ZwTopbar — title / search / activity pill / add</h3>
				<p class="muted">
					Badge counts come from the store. Toggle the activity-pill
					button below to simulate <code>activityHidden</code>.
				</p>
				<div class="topbar-host">
					<ZwTopbar
						:query="topbarQuery"
						:viewport="topbarViewport"
						:scope-title="topbarScope"
						:activity-hidden="topbarActivityHidden"
						:show-menu-button="topbarShowMenu"
						@query="topbarQuery = $event"
						@menu="topbarLast = 'menu'"
						@toggle-activity="topbarActivityHidden = !topbarActivityHidden"
						@add-action="(a) => topbarLast = `add:${a}`"
					/>
				</div>
				<div class="row" style="gap: 12px">
					<ZwButton
						variant="outline"
						size="sm"
						@click="topbarActivityHidden = !topbarActivityHidden"
					>
						Toggle activityHidden
					</ZwButton>
					<ZwButton
						variant="outline"
						size="sm"
						@click="topbarShowMenu = !topbarShowMenu"
					>
						Toggle menu button
					</ZwButton>
					<ZwSegmented
						v-model="topbarScope"
						:options="[
							{ value: 'Overview', label: 'Overview' },
							{ value: 'Needs attention', label: 'Attention' },
							{ value: 'Activity', label: 'Activity' },
						]"
						compact
					/>
					<span class="muted">
						query: <code>{{ topbarQuery || '∅' }}</code> · last:
						<code>{{ topbarLast || '—' }}</code>
					</span>
				</div>
			</div>

			<div class="block">
				<h3>ZwDeviceListToolbar — group + view + columns</h3>
				<p class="muted">
					Group + view segmented selectors; the columns menu only
					renders in table view.
				</p>
				<div class="topbar-host">
					<ZwDeviceListToolbar
						:grouping="toolbarGrouping"
						:view="toolbarView"
						:viewport="topbarViewport"
						:visible-cols="toolbarCols"
						@grouping="toolbarGrouping = $event"
						@view="toolbarView = $event"
						@update:visible-cols="toolbarCols = $event"
					/>
				</div>
				<div class="muted">
					grouping: <code>{{ toolbarGrouping }}</code> · view:
					<code>{{ toolbarView }}</code> · cols:
					<code>{{ Array.from(toolbarCols).join(',') || '∅' }}</code>
				</div>
			</div>

			<div class="block">
				<h3>ZwActivityStrip — live chips + hide button</h3>
				<p class="muted">
					Renders one chip per device with a running transient.
					Strip collapses to nothing when the list is empty.
				</p>
				<div class="topbar-host">
					<ZwActivityStrip
						:transients="activityTransients"
						:viewport="topbarViewport"
						@hide="activityHidden = true"
					/>
				</div>
				<div class="row" style="gap: 12px">
					<ZwButton
						variant="outline"
						size="sm"
						@click="addActivity"
					>
						Add transient
					</ZwButton>
					<ZwButton
						variant="outline"
						size="sm"
						@click="activityTransientsCount = 0"
					>
						Clear all
					</ZwButton>
					<span class="muted">
						strip hidden by user: <code>{{ activityHidden }}</code>
					</span>
				</div>
			</div>

			<div class="block">
				<h3>ZwSidebar — wide / collapsed / mobile</h3>
				<p class="muted">
					Counts read from <code>useDashboardStore</code> (devices,
					attention = battery &lt; 20%, activity = transient ops in flight).
					Click the rail's chevron to expand, the wide sidebar's chevron
					to collapse. Click "Open mobile sidebar" to test the V0 dialog.
				</p>
				<div class="layout-host">
					<div class="layout-host__col">
						<div class="layout-host__label">Wide (240)</div>
						<div class="layout-host__frame layout-host__frame--wide">
							<ZwSidebar
								:active="sidebarActive"
								mode="wide"
								:row-actions="SIDEBAR_ROW_ACTIONS"
								:show-collapse-toggle="false"
								@select="onSidebarSelect"
								@row-action="onSidebarRowAction"
							/>
						</div>
					</div>
					<div class="layout-host__col">
						<div class="layout-host__label">Collapsed (56)</div>
						<div class="layout-host__frame layout-host__frame--rail">
							<ZwSidebar
								:active="sidebarActive"
								mode="collapsed"
								:row-actions="SIDEBAR_ROW_ACTIONS"
								:show-collapse-toggle="true"
								@select="onSidebarSelect"
								@toggle-collapse="onCollapseToggle"
								@row-action="onSidebarRowAction"
							/>
						</div>
					</div>
					<div class="layout-host__col layout-host__col--narrow">
						<div class="layout-host__label">Mobile (overlay)</div>
						<div class="layout-host__frame layout-host__frame--rail">
							<ZwButton variant="outline" size="sm" @click="mobileSidebarOpen = true">
								Open mobile sidebar
							</ZwButton>
						</div>
						<ZwSidebar
							v-model:mobile-open="mobileSidebarOpen"
							:active="sidebarActive"
							mode="mobile"
							:row-actions="SIDEBAR_ROW_ACTIONS"
							@select="onSidebarSelect"
							@row-action="onSidebarRowAction"
						/>
					</div>
				</div>
				<div class="muted">
					active: <code>{{ sidebarActive }}</code> ·
					last action: <code>{{ lastSidebarAction || '—' }}</code>
				</div>
			</div>
		</section>

		<!-- ───────── DRAWER HOST ───────── -->
		<section id="drawer" class="showcase__section">
			<h2>DeviceDrawer</h2>
			<p class="muted">
				The drawer mounts inside this card so its slide-in plays
				correctly without page-level layout (plan 57 handles that).
			</p>
			<div class="drawer-host">
				<div class="drawer-host__hint">
					<p>Click a DeviceCard above, or open a sample directly:</p>
					<div class="row">
						<ZwButton
							v-for="d in devices.slice(0, 4)"
							:key="d.id"
							variant="outline"
							size="sm"
							@click="onOpen(d)"
						>
							Open {{ d.name }}
						</ZwButton>
					</div>
				</div>
				<ZwDeviceDrawer
					:device="openDevice"
					:viewport="viewport"
					@close="openDevice = null"
					@action="onAction"
				/>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'

import ZwPill from '@/components/dashboard/atoms/ZwPill.vue'
import ZwChip from '@/components/dashboard/atoms/ZwChip.vue'
import ZwStatusDot from '@/components/dashboard/atoms/ZwStatusDot.vue'
import ZwBatteryMini from '@/components/dashboard/atoms/ZwBatteryMini.vue'
import ZwToggle from '@/components/dashboard/atoms/ZwToggle.vue'
import ZwSlider from '@/components/dashboard/atoms/ZwSlider.vue'
import ZwSegmented from '@/components/dashboard/atoms/ZwSegmented.vue'
import ZwSearchInput from '@/components/dashboard/atoms/ZwSearchInput.vue'
import ZwUpdateNotifier from '@/components/dashboard/atoms/ZwUpdateNotifier.vue'
import ZwTransientReadout from '@/components/dashboard/atoms/ZwTransientReadout.vue'
import ZwButton from '@/components/dashboard/atoms/ZwButton.vue'
import ZwToggleMenu from '@/components/dashboard/atoms/ZwToggleMenu.vue'

import ZwPrimaryDisplay from '@/components/dashboard/components/ZwPrimaryDisplay.vue'
import ZwDeviceCard from '@/components/dashboard/components/ZwDeviceCard.vue'
import ZwDeviceRow from '@/components/dashboard/components/ZwDeviceRow.vue'
import ZwPropTable from '@/components/dashboard/components/ZwPropTable.vue'
import ZwSecurityPanel from '@/components/dashboard/components/ZwSecurityPanel.vue'
import ZwStatsCard from '@/components/dashboard/components/ZwStatsCard.vue'
import ZwExpandedRow from '@/components/dashboard/components/ZwExpandedRow.vue'
import ZwColumnsMenu from '@/components/dashboard/components/ZwColumnsMenu.vue'
import ZwAddDeviceSplitButton from '@/components/dashboard/components/ZwAddDeviceSplitButton.vue'

import ZwDeviceDrawer from '@/components/dashboard/layout/ZwDeviceDrawer.vue'
import ZwSidebar, { type RowAction } from '@/components/dashboard/layout/ZwSidebar.vue'
import ZwTopbar from '@/components/dashboard/layout/ZwTopbar.vue'
import ZwDeviceListToolbar from '@/components/dashboard/layout/ZwDeviceListToolbar.vue'
import ZwActivityStrip from '@/components/dashboard/layout/ZwActivityStrip.vue'
import useDashboardStore from '@/stores/dashboard'

import {
	AddIcon,
	BulbIcon,
	ContactIcon,
	ControllerIcon,
	DimmerIcon,
	DownloadIcon,
	GridIcon,
	ICON_SIZE,
	ListIcon,
	LocationsIcon,
	LockIcon,
	MoonIcon,
	MoreIcon,
	MotionIcon,
	PlugIcon,
	ShadeIcon,
	SignalLowIcon,
	SwitchIcon,
	TempIcon,
	ThermostatIcon,
	TypeIcon,
} from '@/lib/icons'
import type {
	Device,
	DeviceAction,
} from '@/lib/dashboard-types'

// ── atom showcase state ─────────────────────────────────────────

const PILL_TONES = [
	'neutral',
	'accent',
	'ok',
	'warn',
	'danger',
	'info',
	'asleep',
] as const

const CHIP_TONES = ['neutral', 'accent', 'ok', 'warn', 'danger', 'asleep'] as const

const STATUSES = ['alive', 'awake', 'asleep', 'dead', 'controller'] as const

const TRANSIENTS = {
	ota: { type: 'ota' as const, label: 'OTA update', progress: 0.42 },
	rebuild: {
		type: 'rebuild' as const,
		label: 'Rebuilding routes',
		progress: 0.71,
	},
	interview: {
		type: 'interview' as const,
		label: 'Interviewing',
		progress: 0.08,
	},
}

const toggleA = ref(true)
const sliderVal = ref(60)
const searchVal = ref('')

const GROUP_OPTIONS = [
	{ value: 'location', label: 'Locations', icon: LocationsIcon },
	{ value: 'type', label: 'Types', icon: TypeIcon },
	{ value: 'all', label: 'All', icon: ListIcon },
]
const VIEW_OPTIONS = [
	{ value: 'cards', label: 'Cards', icon: GridIcon },
	{ value: 'table', label: 'Table', icon: ListIcon },
]
const groupSel = ref('location')
const viewSel = ref('cards')

const TOGGLE_MENU_OPTIONS = [
	{ id: 'switch', label: 'Switches', icon: SwitchIcon },
	{ id: 'dimmer', label: 'Dimmers', icon: DimmerIcon },
	{ id: 'lock', label: 'Locks', icon: LockIcon },
	{ id: 'motion', label: 'Motion', icon: MotionIcon },
]
const toggleMenuVal = ref<string[]>(['switch', 'dimmer'])

// ── columns menu ──

const columns = ref<
	('transient' | 'location' | 'value' | 'power' | 'lastSeen')[]
>(['transient', 'location', 'value', 'power', 'lastSeen'])

// ── action sink ──

const lastAction = ref('—')
const lastAddAction = ref('')

function onAction(d: Device, a: DeviceAction) {
	lastAction.value = `${d.name} → ${JSON.stringify(a)}`
}

function onAddAction(a: 'include' | 'replace' | 'exclude') {
	lastAddAction.value = a
}

// ── sample devices ─────────────────────────────────────────────

const controller: Device = {
	id: 1,
	nodeId: 1,
	isController: true,
	name: 'Controller',
	location: '',
	manufacturer: 'Z-Wave.me',
	product: 'RaZberry 7 Pro',
	productCode: 'ZME_RP7',
	archetype: {
		kind: 'controller',
		label: 'Controller',
		icon: ControllerIcon,
		power: 'mains',
	},
	power: { type: 'mains' },
	status: 'alive',
	interviewState: 'complete',
	security: 'S2_AC',
	securityKeys: ['S0', 'S2_UA', 'S2_A', 'S2_AC'],
	firmware: { node: 'v7.6', sdk: 'v7.15.4' },
	protocol: 'Z-Wave Plus v2',
	lastSeen: 'just now',
	primaryValue: null,
	transient: [],
	health: 'ok',
	commStats: {
		can: 0,
		nak: 1,
		timeoutACK: 0,
		timeoutResponse: 2,
		timeoutCallback: 0,
		messagesTX: 1842,
		messagesRX: 2317,
		messagesDroppedTX: 0,
		messagesDroppedRX: 3,
	},
}

function makeDevice(o: Partial<Device> & { id: number; name: string }): Device {
	return {
		isController: false,
		location: 'Living Room',
		manufacturer: 'Inovelli',
		product: 'Blue 2-1',
		productCode: 'LZW36',
		archetype: {
			kind: 'switch',
			label: 'Smart Switch',
			icon: SwitchIcon,
			power: 'mains',
		},
		power: { type: 'mains' },
		status: 'alive',
		interviewState: 'complete',
		security: 'S2_A',
		securityKeys: ['S2_UA', 'S2_A'],
		firmware: { node: 'v1.61', sdk: 'v6.81' },
		lastSeen: '2m ago',
		primaryValue: { type: 'toggle', on: true, watts: 18 },
		transient: [],
		health: 'ok',
		nodeId: o.id,
		...o,
	}
}

const devices: Device[] = [
	makeDevice({
		id: 2,
		name: 'Kitchen Switch',
		location: 'Kitchen',
		primaryValue: { type: 'toggle', on: true, watts: 18 },
	}),
	makeDevice({
		id: 3,
		name: 'Living Room Dimmer',
		archetype: {
			kind: 'dimmer',
			label: 'Dimmer',
			icon: DimmerIcon,
			power: 'mains',
		},
		primaryValue: { type: 'dim', level: 65 },
	}),
	makeDevice({
		id: 4,
		name: 'Hallway Plug',
		location: 'Hallway',
		archetype: {
			kind: 'plug',
			label: 'Smart Plug',
			icon: PlugIcon,
			power: 'mains',
		},
		primaryValue: { type: 'toggle', on: false, watts: 0 },
	}),
	makeDevice({
		id: 5,
		name: 'Front Door Lock',
		location: 'Front Door',
		archetype: {
			kind: 'lock',
			label: 'Door Lock',
			icon: LockIcon,
			power: 'battery',
		},
		power: { type: 'battery', battery: 78 },
		status: 'asleep',
		primaryValue: { type: 'lock', locked: true },
	}),
	makeDevice({
		id: 6,
		name: 'Motion Sensor',
		location: "Kids' Room",
		archetype: {
			kind: 'motion',
			label: 'Motion Sensor',
			icon: MotionIcon,
			power: 'battery',
		},
		power: { type: 'battery', battery: 11 },
		status: 'asleep',
		primaryValue: {
			type: 'state',
			value: 'Motion',
			stateIdx: 1,
			states: ['Clear', 'Motion'],
			colors: ['neutral', 'amber'],
		},
	}),
	makeDevice({
		id: 7,
		name: 'Bedroom Thermostat',
		location: 'Bedroom',
		archetype: {
			kind: 'thermostat',
			label: 'Thermostat',
			icon: ThermostatIcon,
			power: 'battery',
		},
		power: { type: 'battery', battery: 64 },
		primaryValue: {
			type: 'thermostat',
			value: 21,
			unit: '°C',
			setpoint: 22,
			mode: 'heat',
		},
	}),
	makeDevice({
		id: 8,
		name: 'Back Door Contact',
		location: 'Garage',
		archetype: {
			kind: 'contact',
			label: 'Door/Window',
			icon: ContactIcon,
			power: 'battery',
		},
		power: { type: 'battery', battery: 41 },
		primaryValue: {
			type: 'state',
			value: 'Closed',
			stateIdx: 0,
			states: ['Closed', 'Open'],
			colors: ['neutral', 'amber'],
		},
	}),
	makeDevice({
		id: 9,
		name: 'Living Room Shade',
		location: 'Living Room',
		archetype: {
			kind: 'shade',
			label: 'Shade / Blind',
			icon: ShadeIcon,
			power: 'mains',
		},
		primaryValue: { type: 'dim', level: 40 },
	}),
	makeDevice({
		id: 10,
		name: 'Bedside Bulb',
		location: 'Bedroom',
		archetype: {
			kind: 'rgb',
			label: 'RGB Bulb',
			icon: BulbIcon,
			power: 'mains',
		},
		primaryValue: { type: 'dim', level: 80 },
		hasUpdate: true,
	}),
	makeDevice({
		id: 11,
		name: 'Temp Sensor',
		location: 'Basement',
		archetype: {
			kind: 'tempsensor',
			label: 'Temp Sensor',
			icon: TempIcon,
			power: 'battery',
		},
		power: { type: 'battery', battery: 88 },
		primaryValue: { type: 'reading', value: 18.4, unit: '°C' },
	}),
	makeDevice({
		id: 12,
		name: 'Dead Sensor',
		location: 'Attic',
		archetype: {
			kind: 'motion',
			label: 'Motion Sensor',
			icon: MotionIcon,
			power: 'battery',
		},
		power: { type: 'battery', battery: 0 },
		status: 'dead',
		primaryValue: {
			type: 'state',
			value: 'Clear',
			stateIdx: 0,
			states: ['Clear', 'Motion'],
			colors: ['neutral', 'amber'],
		},
	}),
	makeDevice({
		id: 13,
		name: 'OTA in flight',
		location: 'Office',
		archetype: {
			kind: 'switch',
			label: 'Smart Switch',
			icon: SwitchIcon,
			power: 'mains',
		},
		primaryValue: { type: 'toggle', on: false, watts: 0 },
		transient: [{ type: 'ota', label: 'OTA update', progress: 0.42 }],
		hasUpdate: true,
	}),
]

const batteryDevice = devices.find((d) => d.id === 5)!

// ── primary display grid sources ──

const primaryDevices: Device[] = [
	controller,
	devices.find((d) => d.id === 2)!, // toggle
	devices.find((d) => d.id === 3)!, // dim
	devices.find((d) => d.id === 5)!, // lock
	devices.find((d) => d.id === 11)!, // reading
	devices.find((d) => d.id === 6)!, // state
	devices.find((d) => d.id === 7)!, // thermostat
]

const SAMPLE_PROPS: [string, string | number][] = [
	['Manufacturer', 'Inovelli'],
	['Product', 'Blue 2-1'],
	['Code', 'LZW36'],
	['Protocol', 'Z-Wave Plus v2'],
	['Firmware', 'v1.61'],
]

// ── viewport / drawer / expand state ─────────────────────────────

const viewport = ref(window.innerWidth)
const openDevice = ref<Device | null>(null)
const expandedId = ref<Device['id'] | null>(null)

function onOpen(d: Device) {
	openDevice.value = d
}

function onExpand(id: Device['id']) {
	expandedId.value = expandedId.value === id ? null : id
}

function onResize() {
	viewport.value = window.innerWidth
}

onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

// ── layout: sidebar preview state ─────────────────────────────

const dashboardStore = useDashboardStore()
dashboardStore.setDevices([controller, ...devices])

const sidebarActive = ref('overview')
const mobileSidebarOpen = ref(false)
const capturing = ref(false)
const lastSidebarAction = ref('')

const SIDEBAR_ROW_ACTIONS = computed<RowAction[]>(() => [
	{
		navId: 'debug',
		id: 'capture',
		ariaLabel: capturing.value ? 'Stop debug capture' : 'Start debug capture',
		icon: 'circle',
		iconActive: 'square',
		tone: 'danger',
		active: capturing.value,
	},
])

function onSidebarSelect(navId: string) {
	sidebarActive.value = navId
	lastSidebarAction.value = `select:${navId}`
}

function onSidebarRowAction(navId: string, actionId: string) {
	lastSidebarAction.value = `row-action:${navId}:${actionId}`
	if (navId === 'debug' && actionId === 'capture') {
		capturing.value = !capturing.value
	}
}

function onCollapseToggle() {
	lastSidebarAction.value = 'collapse-toggle'
}

// ── layout: topbar preview state ─────────────────────────────

const topbarQuery = ref('')
const topbarViewport = ref(1280)
const topbarScope = ref('Overview')
const topbarActivityHidden = ref(false)
const topbarShowMenu = ref(false)
const topbarLast = ref('')

// ── layout: toolbar preview state ─────────────────────────────

const toolbarGrouping = ref<'location' | 'type' | 'all'>('location')
const toolbarView = ref<'cards' | 'table'>('cards')
const toolbarCols = ref<Set<string>>(
	new Set(['transient', 'location', 'value', 'power', 'lastSeen']),
)

// ── layout: activity strip preview state ─────────────────────

const activityHidden = ref(false)
const activityTransientsCount = ref(2)

const activityTransients = computed<Device[]>(() => {
	const transientDevices = devices.filter((d) => d.transient.length > 0)
	const base = transientDevices.length > 0 ? transientDevices[0] : devices[0]
	const labels = ['OTA update', 'Rebuilding routes', 'Interviewing', 'OTA update', 'Rebuilding routes', 'OTA update', 'OTA update', 'OTA update']
	const names = ['Kitchen Switch', 'Living Room Dimmer', 'Hallway Plug', 'Bedside Bulb', 'Front Door Lock', 'Living Room Shade', 'Bedroom Thermostat', 'Office Plug']
	return Array.from({ length: activityTransientsCount.value }, (_, i) => ({
		...base,
		id: `synth-${i}`,
		name: names[i] ?? `Device ${i + 1}`,
		transient: [{ type: 'ota' as const, label: labels[i] ?? 'OTA update', progress: 0.3 }],
	}))
})

function addActivity() {
	activityTransientsCount.value++
}
</script>

<style scoped>
.showcase {
	padding: 24px;
	max-width: 1240px;
	margin: 0 auto;
	font-family: var(--zw-font);
	color: var(--zw-fg);
}

.showcase__head {
	margin-bottom: 32px;
}

.showcase__head h1 {
	font-size: 24px;
	font-weight: 600;
	margin: 0 0 4px;
}

.showcase__lede {
	color: var(--zw-muted);
	font-size: 13px;
	max-width: 720px;
	margin: 0 0 16px;
}

.showcase__nav {
	display: flex;
	gap: 16px;
	flex-wrap: wrap;
	font-size: 12px;
}

.showcase__nav a {
	color: var(--zw-accent);
	text-decoration: none;
}

.showcase__nav a:hover {
	text-decoration: underline;
}

.showcase__section {
	margin: 48px 0;
	scroll-margin-top: 24px;
}

.showcase__section h2 {
	font-size: 18px;
	font-weight: 600;
	margin: 0 0 4px;
	padding-bottom: 8px;
	border-bottom: 1px solid var(--zw-line);
}

.block {
	margin: 24px 0;
}

.block h3 {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
	margin: 0 0 10px;
	font-weight: 600;
}

.row {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	align-items: center;
}

.row.col {
	flex-direction: column;
	align-items: flex-start;
}

.muted {
	color: var(--zw-muted);
	font-size: 12px;
}

.muted code {
	background: var(--zw-chip-bg);
	padding: 1px 4px;
	border-radius: 3px;
	font-family: var(--zw-mono);
	font-size: 11px;
}

.dot-row {
	gap: 18px;
}

.dot-cell {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 12px;
	color: var(--zw-muted);
}

.primary-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
	gap: 12px;
}

.primary-cell {
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 4px;
	padding: 12px;
	min-height: 96px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	box-shadow: var(--zw-e2);
}

.primary-cell__label {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.card-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	gap: 12px;
}

.table {
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	overflow: hidden;
}

.drawer-host {
	position: relative;
	height: 540px;
	background: var(--zw-bg-soft);
	border: 1px dashed var(--zw-line2);
	border-radius: 6px;
	overflow: hidden;
}

.drawer-host__hint {
	padding: 16px;
	color: var(--zw-muted);
	font-size: 13px;
}

.drawer-host__hint p {
	margin: 0 0 12px;
}

.topbar-host {
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	overflow: hidden;
	margin-bottom: 12px;
}

.layout-host {
	display: flex;
	gap: 16px;
	align-items: flex-start;
	flex-wrap: wrap;
	margin-bottom: 16px;
}

.layout-host__col {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.layout-host__col--narrow {
	min-width: 160px;
}

.layout-host__label {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.layout-host__frame {
	height: 540px;
	background: var(--zw-bg-soft);
	border: 1px dashed var(--zw-line2);
	border-radius: 6px;
	overflow: hidden;
	display: flex;
}

.layout-host__frame--wide {
	width: 240px;
}

.layout-host__frame--rail {
	width: 56px;
}

.layout-host__col--narrow .layout-host__frame {
	width: 160px;
	padding: 12px;
}
</style>
