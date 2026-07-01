<template>
	<div class="zw-nd" :class="`zw-nd--${mode}`">
		<!-- ── Two-pane left rail: primary · status · signal · activity ──
		     Only in the wide (split) layout. The rail surfaces what would
		     otherwise be the Events tab, which is dropped from the tab bar
		     in this mode. -->
		<aside
			v-if="mode === 'split'"
			class="zw-nd__rail"
			:style="{ width: railWidth + 'px' }"
		>
			<div v-if="!device.isController" class="zw-nd__rail-primary">
				<span class="zw-nd__overline">PRIMARY</span>
				<div class="zw-nd__primary">
					<ZwPrimaryDisplay :device="device" @action="onAction" />
				</div>
			</div>
			<div class="zw-nd__rail-section">
				<span class="zw-nd__overline">STATUS</span>
				<span class="zw-nd__status">
					<ZwStatusDot :status="dotStatus" />
					<span class="zw-nd__status-label">{{ statusLabel }}</span>
					<span class="zw-nd__bullet">·</span>
					<span class="zw-nd__lastseen"
						>last seen {{ device.lastSeen }}</span
					>
				</span>
			</div>
			<div class="zw-nd__rail-activity">
				<span class="zw-nd__overline">RECENT ACTIVITY</span>
				<ZwNodeEvents :device="device" :max="25" />
			</div>
		</aside>

		<!-- ── Stacked header: full-width above the tabs (drawer / mobile) ── -->
		<header v-else class="zw-nd__header">
			<div class="zw-nd__header-top">
				<span v-if="!device.isController" class="zw-nd__overline"
					>PRIMARY</span
				>
				<span class="zw-nd__status">
					<ZwStatusDot :status="dotStatus" />
					<span class="zw-nd__status-label">{{ statusLabel }}</span>
					<span class="zw-nd__bullet">·</span>
					<span class="zw-nd__lastseen"
						>last seen {{ device.lastSeen }}</span
					>
				</span>
			</div>
			<div v-if="!device.isController" class="zw-nd__primary">
				<ZwPrimaryDisplay :device="device" @action="onAction" />
			</div>
		</header>

		<!-- ── Tabbed detail content — identical in both layouts. Sits in
		     the right pane (split) or below the header (stacked). -->
		<div class="zw-nd__main">
			<Tabs.Root v-model="tab">
				<Tabs.List as="nav" class="zw-nd__tabs">
					<Tabs.Item
						v-for="t in tabs"
						:key="t.id"
						:value="t.id"
						class="zw-nd__tab"
					>
						{{ t.label }}
						<span
							v-if="
								t.id === 'updates' &&
								!device.isController &&
								device.hasUpdate
							"
							class="zw-nd__tab-dot"
						/>
					</Tabs.Item>
				</Tabs.List>

				<Tabs.Panel value="values" class="zw-nd__content">
					<ZwValuesView :device="device" @action="onAction" />
				</Tabs.Panel>

				<Tabs.Panel
					value="summary"
					class="zw-nd__content"
					:class="
						device.isController
							? 'zw-nd__overview'
							: 'zw-nd__summary'
					"
				>
					<template v-if="device.isController">
						<span class="zw-nd__section-label">Statistics</span>
						<div class="zw-nd__stats">
							<ZwStatsCard
								title="Communication"
								hint="Serial link errors"
								:items="commStats"
							/>
							<ZwStatsCard
								title="Messages"
								hint="Frames since driver start"
								:items="messageStats"
							/>
						</div>
						<ZwControllerOptionsPanel
							:device="device"
							@action="onAction"
						/>
						<span class="zw-nd__section-label">Firmware</span>
						<ZwPropTable :rows="fwRows" />
					</template>
					<template v-else>
						<ZwPropTable title="Device" :rows="deviceRows" />
						<ZwPropTable title="Firmware" :rows="fwRows" />
						<ZwSecurityPanel :device="device" />
					</template>
				</Tabs.Panel>

				<Tabs.Panel value="associations" class="zw-nd__content">
					<ZwAssociationsTab :device="device" @action="onAction" />
				</Tabs.Panel>

				<Tabs.Panel value="updates" class="zw-nd__content">
					<ZwUpdatesTab :device="device" @action="onAction" />
				</Tabs.Panel>

				<!-- Events is omitted from the tab bar in the split layout
				     (its content lives in the rail), so the panel is only
				     mounted in the stacked layout. -->
				<Tabs.Panel
					v-if="mode === 'stacked'"
					value="events"
					class="zw-nd__content"
				>
					<ZwNodeEvents :device="device" />
				</Tabs.Panel>

				<Tabs.Panel
					value="debug"
					class="zw-nd__content"
					:class="{ 'zw-nd__debug': device.isController }"
				>
					<template v-if="device.isController">
						<ZwActionList>
							<ZwActionBtn
								title="Export controller JSON"
								description="Download the controller's definition for backup or diagnostics."
								:actions="[
									{ label: 'UI', doneLabel: 'Saved' },
									{ label: 'Driver', doneLabel: 'Saved' },
								]"
								@run="
									(i: number) =>
										emit('action', device, {
											type:
												i === 0
													? 'export-ui'
													: 'export-json',
										})
								"
							>
								<template #icon
									><DownloadIcon :size="ICON_SIZE.std"
								/></template>
							</ZwActionBtn>
							<ZwActionBtn
								title="NVM Backup / Restore"
								description="Back up or restore the controller's non-volatile memory."
								:actions="[
									{
										label: 'Backup',
										busyLabel: 'Backing up…',
										doneLabel: 'Done',
									},
									{
										label: 'Restore',
										busyLabel: 'Restoring…',
										doneLabel: 'Done',
									},
								]"
								:action-states="nvmStates"
								@run="
									(i: number) =>
										emit('action', device, {
											type:
												i === 0
													? 'backup-nvm'
													: 'restore-nvm',
										})
								"
							>
								<template #icon
									><DatabaseIcon :size="ICON_SIZE.std"
								/></template>
							</ZwActionBtn>
						</ZwActionList>
						<ZwActionList>
							<ZwActionBtn
								title="Shutdown"
								description="Safely shut down the Z-Wave API so the stick can be unplugged."
								:actions="[
									{
										label: 'Shutdown',
										busyLabel: 'Shutting down…',
									},
								]"
								:action-states="shutdownState"
								tone="accent"
								@run="
									emit('action', device, { type: 'shutdown' })
								"
							>
								<template #icon
									><PowerIcon :size="ICON_SIZE.std"
								/></template>
							</ZwActionBtn>
							<ZwActionBtn
								title="Soft reset"
								description="Restart the controller. The network is preserved."
								:actions="[
									{
										label: 'Soft reset',
										busyLabel: 'Resetting…',
										doneLabel: 'Done',
									},
								]"
								:action-states="softResetState"
								@run="
									emit('action', device, {
										type: 'soft-reset',
									})
								"
							>
								<template #icon
									><RefreshIcon :size="ICON_SIZE.std"
								/></template>
							</ZwActionBtn>
							<ZwActionBtn
								title="Factory reset"
								description="Reset the controller to factory defaults. Every paired device will be removed."
								:actions="[
									{
										label: 'Reset',
										busyLabel: 'Resetting…',
									},
								]"
								:action-states="factoryResetState"
								tone="danger"
								@run="
									emit('action', device, {
										type: 'factory-reset',
									})
								"
							>
								<template #icon
									><AlertIcon :size="ICON_SIZE.std"
								/></template>
							</ZwActionBtn>
						</ZwActionList>
					</template>
					<ZwActionList v-else>
						<ZwActionBtn
							title="Ping"
							description="Send a no-op command to check the node responds."
							:actions="[
								{
									label: 'Ping',
									busyLabel: 'Pinging…',
									doneLabel: 'Sent',
								},
							]"
							tone="accent"
							@run="emit('action', device, { type: 'ping' })"
						>
							<template #icon
								><PulseIcon :size="ICON_SIZE.std"
							/></template>
						</ZwActionBtn>
						<ZwActionBtn
							title="Re-interview node"
							description="Clear all info and run a fresh interview."
							:actions="[
								{
									label: 'Interview',
									busyLabel: 'Interviewing…',
									doneLabel: 'Queued',
								},
							]"
							@run="emit('action', device, { type: 'interview' })"
						>
							<template #icon
								><InterviewIcon :size="ICON_SIZE.std"
							/></template>
						</ZwActionBtn>
						<ZwActionBtn
							title="Rebuild routes"
							description="Recompute the mesh routes between the controller and this node."
							:actions="[
								{
									label: 'Rebuild',
									busyLabel: 'Rebuilding…',
									doneLabel: 'Done',
								},
							]"
							@run="emit('action', device, { type: 'rebuild' })"
						>
							<template #icon
								><NetworkIcon :size="ICON_SIZE.std"
							/></template>
						</ZwActionBtn>
						<ZwActionBtn
							title="Export node JSON"
							description="Download this node's definition for backup or sharing."
							:actions="[
								{ label: 'UI', doneLabel: 'Saved' },
								{ label: 'Driver', doneLabel: 'Saved' },
							]"
							@run="
								(i: number) =>
									emit('action', device, {
										type:
											i === 0
												? 'export-ui'
												: 'export-json',
									})
							"
						>
							<template #icon
								><DownloadIcon :size="ICON_SIZE.std"
							/></template>
						</ZwActionBtn>
					</ZwActionList>
				</Tabs.Panel>
			</Tabs.Root>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, inject, shallowRef, watch } from 'vue'
import { Tabs } from '@vuetify/v0'
import ZwStatusDot from '@/components/dashboard/atoms/ZwStatusDot.vue'
import ZwPrimaryDisplay from './ZwPrimaryDisplay.vue'
import ZwPropTable from './ZwPropTable.vue'
import ZwSecurityPanel from './ZwSecurityPanel.vue'
import ZwStatsCard, { type StatsItem } from './ZwStatsCard.vue'
import ZwActionList from './ZwActionList.vue'
import ZwActionBtn from './ZwActionBtn.vue'
import ZwAssociationsTab from './ZwAssociationsTab.vue'
import ZwUpdatesTab from './ZwUpdatesTab.vue'
import ZwNodeEvents from './ZwNodeEvents.vue'
import ZwValuesView from './ZwValuesView.vue'
import ZwControllerOptionsPanel from './ZwControllerOptionsPanel.vue'
import {
	AlertIcon,
	DatabaseIcon,
	DownloadIcon,
	ICON_SIZE,
	InterviewIcon,
	NetworkIcon,
	PowerIcon,
	PulseIcon,
	RefreshIcon,
} from '@/lib/icons'
import {
	RAIL_WIDTH_BREAKPOINT,
	RAIL_WIDTH_COMPACT,
	RAIL_WIDTH_SPACIOUS,
	TWO_PANE_BREAKPOINT,
} from '@/lib/dashboard-breakpoints'
import useBaseStore from '@/stores/base'
import { buildValueGroups } from '@/lib/valueGroups.ts'
import type { Device, DeviceAction } from '@/lib/dashboard-types'
import {
	actionPendingKey,
	DeviceActionStatusKey,
	type ActionStatus,
} from '@/lib/deviceActionPending.ts'
import type { BtnState } from './ZwActionBtn.vue'

// `viewport` is the host panel's width. `layout="stacked"` forces
// single-column regardless of width (used by the card-view drawer).
const props = withDefaults(
	defineProps<{
		device: Device
		viewport?: number
		layout?: 'auto' | 'stacked'
	}>(),
	{ viewport: 0, layout: 'auto' },
)
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const baseStore = useBaseStore()

const status = inject(
	DeviceActionStatusKey,
	shallowRef<ReadonlyMap<string, ActionStatus>>(new Map()),
)

function btnState(actionType: DeviceAction['type']): BtnState {
	const key = actionPendingKey(props.device, {
		type: actionType,
	} as DeviceAction)
	if (!key) return 'idle'
	const s = status.value.get(key)
	if (s === 'pending') return 'busy'
	if (s === 'ok') return 'done'
	return 'idle'
}

const nvmStates = computed<BtnState[]>(() => [
	btnState('backup-nvm'),
	btnState('restore-nvm'),
])

const shutdownState = computed<BtnState[]>(() => [btnState('shutdown')])
const softResetState = computed<BtnState[]>(() => [btnState('soft-reset')])
const factoryResetState = computed<BtnState[]>(() => [
	btnState('factory-reset'),
])

function onAction(d: Device, a: DeviceAction) {
	emit('action', d, a)
}

type TabId =
	| 'values'
	| 'summary'
	| 'associations'
	| 'updates'
	| 'events'
	| 'debug'

interface TabEntry {
	id: TabId
	label: string
}

const NODE_TABS: TabEntry[] = [
	{ id: 'values', label: 'Values' },
	{ id: 'summary', label: 'Summary' },
	{ id: 'associations', label: 'Associations' },
	{ id: 'updates', label: 'Updates' },
	{ id: 'events', label: 'Events' },
	{ id: 'debug', label: 'Debug' },
]

const CONTROLLER_BASE_TABS: TabEntry[] = [
	{ id: 'summary', label: 'Overview' },
	{ id: 'values', label: 'Values' },
	{ id: 'associations', label: 'Associations' },
	{ id: 'updates', label: 'Updates' },
	{ id: 'events', label: 'Events' },
	{ id: 'debug', label: 'Debug' },
]

const controllerHasValues = computed(() =>
	props.device.isController
		? buildValueGroups(baseStore.getNode(props.device.nodeId)).length > 0
		: true,
)

const controllerTabs = computed(() =>
	controllerHasValues.value
		? CONTROLLER_BASE_TABS
		: CONTROLLER_BASE_TABS.filter((t) => t.id !== 'values'),
)

const ALL_TABS = computed(() =>
	props.device.isController ? controllerTabs.value : NODE_TABS,
)

// Two-pane on wider panels; stacked in the drawer and on narrow screens.
const mode = computed<'split' | 'stacked'>(() =>
	props.layout === 'stacked'
		? 'stacked'
		: props.viewport >= TWO_PANE_BREAKPOINT
			? 'split'
			: 'stacked',
)

// In split mode the Events tab is dropped — its content lives in the rail.
const tabs = computed(() =>
	mode.value === 'split'
		? ALL_TABS.value.filter((t) => t.id !== 'events')
		: ALL_TABS.value,
)

const railWidth = computed(() =>
	props.viewport >= RAIL_WIDTH_BREAKPOINT
		? RAIL_WIDTH_SPACIOUS
		: RAIL_WIDTH_COMPACT,
)

function defaultTab(): TabId {
	return props.device.isController ? 'summary' : 'values'
}

const tab = ref<TabId>(defaultTab())

// Switching to a different device resets to that device's default tab.
watch(
	() => props.device.nodeId,
	() => {
		tab.value = defaultTab()
	},
)

// Collapsing to two-pane drops the Events tab — fall back to the default.
watch(mode, (m) => {
	if (m === 'split' && tab.value === 'events') tab.value = defaultTab()
})

const dotStatus = computed(() =>
	props.device.isController ? 'controller' : props.device.status,
)

const statusLabel = computed(() => {
	const s = props.device.isController ? 'controller' : props.device.status
	return s.charAt(0).toUpperCase() + s.slice(1)
})

const deviceRows = computed<[string, string | number][]>(() => [
	['Device class', props.device.archetype.label],
	['Interview', props.device.interviewState],
])

const fwRows = computed<[string, string | number][]>(() => [
	['Version', props.device.firmware?.node ?? '—'],
	['SDK', props.device.firmware?.sdk ?? '—'],
])

const commStats = computed<StatsItem[]>(() => {
	const s = props.device.commStats
	return [
		{ label: 'CAN', value: s?.can ?? 0 },
		{ label: 'NAK', value: s?.nak ?? 0 },
		{ label: 'ACK Timeout', value: s?.timeoutACK ?? 0 },
		{ label: 'Response Timeout', value: s?.timeoutResponse ?? 0 },
		{ label: 'Callback Timeout', value: s?.timeoutCallback ?? 0 },
	]
})

const messageStats = computed<StatsItem[]>(() => {
	const s = props.device.commStats
	return [
		{ label: 'TX', value: s?.messagesTX ?? 0 },
		{ label: 'RX', value: s?.messagesRX ?? 0 },
		{ label: 'Dropped TX', value: s?.messagesDroppedTX ?? 0 },
		{ label: 'Dropped RX', value: s?.messagesDroppedRX ?? 0 },
	]
})
</script>

<style>
.zw-nd {
	display: flex;
	min-width: 0;
}

.zw-nd--stacked {
	flex-direction: column;
}

/* Two-pane: rail on the left, tabbed content on the right. `stretch`
   (the flex default) keeps the rail's right border full-height regardless
   of which column is taller. */
.zw-nd--split {
	flex-direction: row;
	align-items: stretch;
}

/* The tabbed content well. Carries the container so summary/debug grids
   pack to the content width — NOT the whole component — which matters in
   the split layout where the rail eats 300–340px. */
.zw-nd__main {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-width: 0;
	container-type: inline-size;
	container-name: zw-nd;
}

/* ── Left rail (split only) ──────────────────────────────────── */
.zw-nd__rail {
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 16px;
	background: var(--zw-bg-soft);
	border-right: 1px solid var(--zw-line);
}

.zw-nd__rail-primary {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.zw-nd__rail-section {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.zw-nd__rail-activity {
	border-top: 1px solid var(--zw-line);
	padding-top: 14px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

/* ── Stacked header ──────────────────────────────────────────── */
.zw-nd__header {
	padding: 16px;
	background: var(--zw-bg-soft);
	border-bottom: 1px solid var(--zw-line);
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.zw-nd__header-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.zw-nd__overline {
	font-family: var(--zw-mono);
	font-size: 10px;
	font-weight: 600;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.zw-nd__status {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.zw-nd__status-label {
	font-size: 12px;
	font-weight: 500;
	color: var(--zw-fg);
}

.zw-nd__bullet {
	color: var(--zw-muted);
}

.zw-nd__lastseen {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
}

.zw-nd__primary {
	font-size: 24px;
}

/* ── Tabs ────────────────────────────────────────────────────── */
.zw-nd__tabs {
	display: flex;
	gap: 4px;
	padding: 8px 12px;
	border-bottom: 1px solid var(--zw-line);
	background: var(--zw-card);
	overflow-x: auto;
}

.zw-nd__tab {
	appearance: none;
	background: transparent;
	border: none;
	cursor: pointer;
	padding: 5px 10px;
	border-radius: 4px;
	font-family: var(--zw-font);
	font-size: 12px;
	font-weight: 500;
	color: var(--zw-muted);
	text-transform: capitalize;
	white-space: nowrap;
	transition:
		background 0.12s,
		color 0.12s;
}

/* V0 Tabs.Item emits `data-selected="true"` on the active tab. */
.zw-nd__tab[data-selected='true'] {
	background: var(--zw-accent);
	color: var(--zw-on-accent);
}

.zw-nd__tab:focus-visible {
	outline: 2px solid var(--zw-accent);
	outline-offset: 1px;
}

.zw-nd__tab-dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: var(--zw-accent);
	box-shadow: 0 0 0 1.5px var(--zw-card);
	flex-shrink: 0;
}

.zw-nd__tab[data-selected='true'] .zw-nd__tab-dot {
	background: var(--zw-on-accent);
	box-shadow: none;
}

/* ── Content ─────────────────────────────────────────────────── */
.zw-nd__content {
	padding: 14px 16px 18px;
	background: var(--zw-bg);
	font-size: 12px;
}

/* V0 Tabs.Panel hides inactive panels via the native `hidden` HTML
   attribute. Several panels below set `display: grid`, which would win
   over the user-agent's `display: none` for `[hidden]` — force the
   hidden state at higher specificity. */
.zw-nd__content[hidden] {
	display: none !important;
}

.zw-nd__summary {
	display: grid;
	grid-template-columns: 1fr;
	gap: 12px;
}

@container zw-nd (min-width: 540px) {
	.zw-nd__summary {
		grid-template-columns: 1fr 1fr;
	}
}

@container zw-nd (min-width: 820px) {
	.zw-nd__summary {
		grid-template-columns: 1fr 1fr 1fr;
	}
}

/* Controller overview — single-column stack, not the responsive grid
   the node summary uses. */
.zw-nd__overview {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.zw-nd__section-label {
	font-family: var(--zw-mono);
	font-size: 10px;
	font-weight: 600;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

/* Controller debug tab — two action-list cards stacked. */
.zw-nd__debug {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.zw-nd__empty {
	padding: 24px;
	color: var(--zw-muted);
	text-align: center;
	font-style: italic;
}

.zw-nd__stats {
	display: grid;
	grid-template-columns: 1fr;
	gap: 12px;
}

@container zw-nd (min-width: 540px) {
	.zw-nd__stats {
		grid-template-columns: 1fr 1fr;
	}
}
</style>
