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
			<div class="zw-nd__rail-primary">
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
				<span class="zw-nd__overline">PRIMARY</span>
				<span class="zw-nd__status">
					<ZwStatusDot :status="dotStatus" />
					<span class="zw-nd__status-label">{{ statusLabel }}</span>
					<span class="zw-nd__bullet">·</span>
					<span class="zw-nd__lastseen"
						>last seen {{ device.lastSeen }}</span
					>
				</span>
			</div>
			<div class="zw-nd__primary">
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
					</Tabs.Item>
				</Tabs.List>

				<Tabs.Panel value="values" class="zw-nd__content">
					<div v-if="device.isController" class="zw-nd__empty">
						Controller exposes no command-class values.
					</div>
					<ZwValuesView v-else :device="device" @action="onAction" />
				</Tabs.Panel>

				<Tabs.Panel
					value="summary"
					class="zw-nd__content zw-nd__summary"
				>
					<ZwPropTable title="Device" :rows="deviceRows" />
					<ZwPropTable title="Firmware" :rows="fwRows" />
					<ZwSecurityPanel :device="device" />
				</Tabs.Panel>

				<Tabs.Panel value="associations" class="zw-nd__content">
					<ZwAssociationsTab :device="device" @action="onAction" />
				</Tabs.Panel>

				<Tabs.Panel
					value="updates"
					class="zw-nd__content zw-nd__updates"
				>
					<div v-if="device.hasUpdate" class="zw-nd__update-card">
						<div class="zw-nd__update-current">
							Current {{ device.firmware?.node ?? '—' }}
						</div>
						<div class="zw-nd__update-line">
							Update available — see the device drawer's footer to
							apply.
						</div>
					</div>
					<div v-else class="zw-nd__empty">
						No firmware update available.
					</div>
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

				<Tabs.Panel value="debug" class="zw-nd__content">
					<div v-if="device.isController" class="zw-nd__stats">
						<ZwStatsCard title="Communication" :items="commStats" />
						<ZwStatsCard title="Messages" :items="messageStats" />
					</div>
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

				<Tabs.Panel
					value="advanced"
					class="zw-nd__content zw-nd__advanced"
				>
					<ZwButton
						v-for="cmd in advancedCommands"
						:key="cmd.label"
						variant="mono-outline"
						size="sm"
						@click="emit('action', device, cmd.action)"
					>
						{{ cmd.label }}
					</ZwButton>
				</Tabs.Panel>
			</Tabs.Root>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Tabs } from '@vuetify/v0'
import ZwStatusDot from '@/components/dashboard/atoms/ZwStatusDot.vue'
import ZwButton from '@/components/dashboard/atoms/ZwButton.vue'
import ZwPrimaryDisplay from './ZwPrimaryDisplay.vue'
import ZwPropTable from './ZwPropTable.vue'
import ZwSecurityPanel from './ZwSecurityPanel.vue'
import ZwStatsCard, { type StatsItem } from './ZwStatsCard.vue'
import ZwActionList from './ZwActionList.vue'
import ZwActionBtn from './ZwActionBtn.vue'
import ZwAssociationsTab from './ZwAssociationsTab.vue'
import ZwNodeEvents from './ZwNodeEvents.vue'
import ZwValuesView from './ZwValuesView.vue'
import {
	DownloadIcon,
	ICON_SIZE,
	InterviewIcon,
	NetworkIcon,
	PulseIcon,
} from '@/lib/icons'
import {
	RAIL_WIDTH_BREAKPOINT,
	RAIL_WIDTH_COMPACT,
	RAIL_WIDTH_SPACIOUS,
	TWO_PANE_BREAKPOINT,
} from '@/lib/dashboard-breakpoints'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

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
	| 'advanced'

const ALL_TABS: { id: TabId; label: string }[] = [
	{ id: 'values', label: 'Values' },
	{ id: 'summary', label: 'Summary' },
	{ id: 'associations', label: 'Associations' },
	{ id: 'updates', label: 'Updates' },
	{ id: 'events', label: 'Events' },
	{ id: 'debug', label: 'Debug' },
	{ id: 'advanced', label: 'Advanced' },
]

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
		? ALL_TABS.filter((t) => t.id !== 'events')
		: ALL_TABS,
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
		{ label: 'Timeout ACK', value: s?.timeoutACK ?? 0 },
		{ label: 'Timeout Response', value: s?.timeoutResponse ?? 0 },
		{ label: 'Timeout Callback', value: s?.timeoutCallback ?? 0 },
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

const advancedCommands = computed<{ label: string; action: DeviceAction }[]>(
	() =>
		props.device.isController
			? [
					{ label: 'Heal', action: { type: 'heal' } },
					{ label: 'Backup NVM', action: { type: 'backup-nvm' } },
					{ label: 'Restore NVM', action: { type: 'restore-nvm' } },
					{ label: 'Reset stats', action: { type: 'reset-stats' } },
					{ label: 'Export JSON', action: { type: 'export-json' } },
					{
						label: 'Update topics',
						action: { type: 'update-topics' },
					},
					{ label: 'Hard reset', action: { type: 'hard-reset' } },
					{
						label: 'Restart driver',
						action: { type: 'restart-driver' },
					},
				]
			: [
					{ label: 'Interview', action: { type: 'interview' } },
					{ label: 'Refresh', action: { type: 'refresh' } },
					{ label: 'Rebuild', action: { type: 'rebuild' } },
					{ label: 'Replace', action: { type: 'replace-failed' } },
					{ label: 'Remove', action: { type: 'remove' } },
					{ label: 'Ping', action: { type: 'ping' } },
					{ label: 'Export', action: { type: 'export' } },
					{ label: 'Clear', action: { type: 'clear' } },
				],
)
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
}

.zw-nd__header-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12px;
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
	color: #fff;
}

.zw-nd__tab:focus-visible {
	outline: 2px solid var(--zw-accent);
	outline-offset: 1px;
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

.zw-nd__empty {
	padding: 24px;
	color: var(--zw-muted);
	text-align: center;
	font-style: italic;
}

.zw-nd__updates {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.zw-nd__update-card {
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	padding: 12px;
}

.zw-nd__update-current {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
	margin-bottom: 4px;
}

.zw-nd__update-line {
	font-size: 13px;
	color: var(--zw-fg);
}

.zw-nd__advanced {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: 8px;
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
