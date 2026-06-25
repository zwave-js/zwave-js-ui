<template>
	<div class="zw-nd">
		<header class="zw-nd__header">
			<div class="zw-nd__header-top">
				<span class="zw-nd__overline">PRIMARY</span>
				<span class="zw-nd__status">
					<ZwStatusDot
						:status="
							device.isController ? 'controller' : device.status
						"
					/>
					<span class="zw-nd__status-label">{{ statusLabel }}</span>
					<span class="zw-nd__bullet">·</span>
					<span class="zw-nd__lastseen"
						>last seen {{ device.lastSeen }}</span
					>
				</span>
			</div>
			<div class="zw-nd__primary">
				<ZwPrimaryDisplay
					:device="device"
					@action="(d, a) => emit('action', d, a)"
				/>
			</div>
		</header>

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
				<div v-else class="zw-nd__values-stub">
					<!-- Placeholder until the full values view is built. -->
					Values pane — full view coming soon.
				</div>
			</Tabs.Panel>

			<Tabs.Panel value="summary" class="zw-nd__content zw-nd__summary">
				<ZwPropTable :rows="manufacturerRows" />
				<ZwPropTable :rows="firmwareRows" />
				<ZwSecurityPanel :device="device" />
			</Tabs.Panel>

			<Tabs.Panel value="groups" class="zw-nd__content">
				<ZwPropTable :rows="groupsStub" />
			</Tabs.Panel>

			<Tabs.Panel value="updates" class="zw-nd__content zw-nd__updates">
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

			<Tabs.Panel value="events" class="zw-nd__content zw-nd__events">
				<template v-if="events.length === 0">
					<div class="zw-nd__empty">No recent events</div>
				</template>
				<template v-else>
					<div
						v-for="(ev, i) in events"
						:key="i"
						class="zw-nd__event"
					>
						<span class="zw-nd__event-time">{{
							relativeTime(toMs(ev.time), now)
						}}</span>
						<div class="zw-nd__event-body">
							<div class="zw-nd__event-name">{{ ev.event }}</div>
							<div
								v-if="eventDetail(ev)"
								class="zw-nd__event-detail"
							>
								{{ eventDetail(ev) }}
							</div>
						</div>
					</div>
					<div
						v-if="totalEvents > MAX_EVENTS"
						class="zw-nd__event-footer"
					>
						+{{ totalEvents - MAX_EVENTS }} earlier events
					</div>
				</template>
			</Tabs.Panel>

			<Tabs.Panel value="debug" class="zw-nd__content">
				<div v-if="device.isController" class="zw-nd__stats">
					<ZwStatsCard title="Communication" :items="commStats" />
					<ZwStatsCard title="Messages" :items="messageStats" />
				</div>
				<ZwPropTable v-else :rows="debugRows" />
			</Tabs.Panel>

			<Tabs.Panel value="advanced" class="zw-nd__content zw-nd__advanced">
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
import type { Device, DeviceAction } from '@/lib/dashboard-types'
import useBaseStore from '@/stores/base'
import { relativeTime, useNow } from '@/lib/time'

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

type TabId =
	| 'values'
	| 'summary'
	| 'groups'
	| 'updates'
	| 'events'
	| 'debug'
	| 'advanced'

const tabs: { id: TabId; label: string }[] = [
	{ id: 'values', label: 'Values' },
	{ id: 'summary', label: 'Summary' },
	{ id: 'groups', label: 'Groups' },
	{ id: 'updates', label: 'Updates' },
	{ id: 'events', label: 'Events' },
	{ id: 'debug', label: 'Debug' },
	{ id: 'advanced', label: 'Advanced' },
]

const tab = ref<TabId>(props.device.isController ? 'summary' : 'values')

// Switching to a different device resets to that device's default tab.
watch(
	() => props.device.nodeId,
	() => {
		tab.value = props.device.isController ? 'summary' : 'values'
	},
)

const statusLabel = computed(() => {
	const s = props.device.isController ? 'controller' : props.device.status
	return s.charAt(0).toUpperCase() + s.slice(1)
})

const manufacturerRows = computed<[string, string | number][]>(() => [
	['Manufacturer', props.device.manufacturer ?? '—'],
	['Product', props.device.product ?? '—'],
	['Code', props.device.productCode ?? '—'],
	['Protocol', props.device.protocol ?? '—'],
])

const firmwareRows = computed<[string, string | number][]>(() => [
	['Firmware', props.device.firmware?.node ?? '—'],
	['SDK', props.device.firmware?.sdk ?? '—'],
	['Last seen', props.device.lastSeen],
	['Interview', props.device.interviewState],
])

// Placeholder association-group rows.
const groupsStub: [string, string][] = [
	['Lifeline', '1 → Controller'],
	['NodeID_1', '—'],
	['Endpoint', '—'],
]

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

const debugRows = computed<[string, string | number][]>(() => [
	['Endpoint count', '1'],
	['Routing scheme', '—'],
	['Tx power', String(props.device.txPower ?? 0) + ' dBm'],
	['Wakeup interval', props.device.power.type === 'battery' ? '3600s' : '—'],
	['Generic device class', props.device.archetype.label],
])

// ── events tab ───────────────────────────────────────────────
// Reads `node.eventsQueue` from the base store, looked up by
// `device.nodeId`, so it tracks socket events live.
const baseStore = useBaseStore()
const now = useNow()
const MAX_EVENTS = 50

interface NodeEventEntry {
	event: string
	args?: unknown[]
	time?: Date | string | number
}

const eventsQueue = computed<NodeEventEntry[]>(() => {
	const node = baseStore.getNode(props.device.nodeId)
	const q = node?.eventsQueue
	return Array.isArray(q) ? (q as NodeEventEntry[]) : []
})

const totalEvents = computed(() => eventsQueue.value.length)

const events = computed<NodeEventEntry[]>(() =>
	eventsQueue.value.slice(-MAX_EVENTS).reverse(),
)

function toMs(t: NodeEventEntry['time']): number | undefined {
	if (!t) return undefined
	if (t instanceof Date) return t.getTime()
	if (typeof t === 'number') return t
	const d = new Date(t)
	const n = d.getTime()
	return Number.isNaN(n) ? undefined : n
}

function eventDetail(ev: NodeEventEntry): string {
	// Event arg shapes vary: treat the first arg as the new value when
	// present, and stringify the rest.
	if (!Array.isArray(ev.args) || ev.args.length === 0) return ''
	const first = ev.args[0] as unknown
	if (first && typeof first === 'object') {
		const o = first as { propertyName?: string; newValue?: unknown }
		if (o.propertyName !== undefined && o.newValue !== undefined) {
			return `${o.propertyName} → ${formatValue(o.newValue)}`
		}
	}
	return ev.args.map((a) => formatValue(a)).join(' · ')
}

function formatValue(v: unknown): string {
	if (v === null || v === undefined) return '—'
	if (typeof v === 'object') {
		try {
			return JSON.stringify(v)
		} catch {
			return String(v)
		}
	}
	return String(v)
}

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
/* Unscoped — V0 Tabs primitives use inheritAttrs:false, so the scoped
   data-v-* hash never reaches the tab list/items/panels. The .zw-nd
   namespace is unique to this component. */
.zw-nd {
	display: flex;
	flex-direction: column;
	container-type: inline-size;
	container-name: zw-nd;
}

/* ── Header ──────────────────────────────────────────────────── */
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

.zw-nd__values-stub {
	padding: 24px;
	color: var(--zw-muted);
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

/* ── Events tab ──────────────────────────────────────────────── */
.zw-nd__events {
	display: flex;
	flex-direction: column;
	gap: 0;
}

.zw-nd__event {
	display: flex;
	gap: 10px;
	padding: 8px 0;
	border-bottom: 1px dashed var(--zw-line);
}

.zw-nd__event:last-of-type {
	border-bottom: none;
}

.zw-nd__event-time {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
	width: 72px;
	flex-shrink: 0;
}

.zw-nd__event-body {
	min-width: 0;
}

.zw-nd__event-name {
	font-size: 12px;
	font-weight: 500;
}

.zw-nd__event-detail {
	font-size: 11px;
	color: var(--zw-muted);
	margin-top: 2px;
	word-break: break-word;
}

.zw-nd__event-footer {
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px dashed var(--zw-line);
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
	text-align: center;
}
</style>
