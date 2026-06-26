<template>
	<div class="zw-node-events">
		<div v-if="rows.length === 0" class="zw-node-events__empty">
			No recent events
		</div>
		<template v-else>
			<div v-for="(row, i) in rows" :key="i" class="zw-node-events__row">
				<span class="zw-node-events__time">{{
					relativeTime(row.timeMs, now)
				}}</span>
				<div class="zw-node-events__body">
					<div class="zw-node-events__name">{{ row.name }}</div>
					<div v-if="row.detail" class="zw-node-events__detail">
						{{ row.detail }}
					</div>
				</div>
			</div>
			<div v-if="overflow > 0" class="zw-node-events__footer">
				+{{ overflow }} earlier events
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
	TranslatedValueID,
	ValueUpdatedArgs,
	ValueNotificationArgs,
} from '@zwave-js/core'
import type { Device } from '@/lib/dashboard-types'
import useBaseStore from '@/stores/base'
import { relativeTime, useNow } from '@/lib/time'
import { valueIdKey } from '@/components/dashboard/deviceActionPending.ts'

// Live feed of a node's recent events, shared by the Events tab and the rail's
// "Recent activity". `max` caps entries (the rail passes a smaller cap).
const props = withDefaults(defineProps<{ device: Device; max?: number }>(), {
	max: 50,
})

const baseStore = useBaseStore()
const now = useNow()

interface NodeEventEntry {
	event: string
	args?: unknown[]
	time?: Date | string | number
}

// `node.eventsQueue` from the store, so it tracks socket events live.
const eventsQueue = computed<NodeEventEntry[]>(() => {
	const node = baseStore.getNode(props.device.nodeId)
	const q = node?.eventsQueue
	return Array.isArray(q) ? (q as NodeEventEntry[]) : []
})

const events = computed<NodeEventEntry[]>(() =>
	eventsQueue.value.slice(-props.max).reverse(),
)

const overflow = computed(() =>
	Math.max(0, eventsQueue.value.length - props.max),
)

function toMs(t: NodeEventEntry['time']): number | undefined {
	if (!t) return undefined
	if (t instanceof Date) return t.getTime()
	if (typeof t === 'number') return t
	const d = new Date(t)
	const n = d.getTime()
	return Number.isNaN(n) ? undefined : n
}

// A value-updated/notification event arg, loosely typed — queue args are
// untyped, so every field may be absent.
type ValueEventArg = Partial<
	TranslatedValueID & ValueUpdatedArgs & ValueNotificationArgs
>

// value-id → metadata label, rebuilt per node-values change. O(1) lookup avoids
// re-scanning values per event per render; raw event payloads lack the label.
const valueLabelIndex = computed(() => {
	const node = baseStore.getNode(props.device.nodeId) as
		| { values?: (ValueEventArg & { label?: string })[] }
		| undefined
	const map = new Map<string, string>()
	if (Array.isArray(node?.values)) {
		for (const v of node.values) {
			if (v?.label) map.set(valueIdKey(v), v.label)
		}
	}
	return map
})

function eventDetail(ev: NodeEventEntry): string {
	// Prefer a value's metadata label over its raw property for value events.
	if (!Array.isArray(ev.args) || ev.args.length === 0) return ''
	const first = ev.args[0] as unknown
	if (first && typeof first === 'object') {
		const o = first as ValueEventArg
		const next = o.newValue !== undefined ? o.newValue : o.value
		if (
			next !== undefined &&
			(o.property !== undefined || o.propertyName)
		) {
			const label =
				valueLabelIndex.value.get(valueIdKey(o)) ??
				o.propertyName ??
				String(o.property)
			return `${label} → ${formatValue(next)}`
		}
	}
	return ev.args.map((a) => formatValue(a)).join(' · ')
}

// Pre-resolve display strings per data change, so the `now` tick re-runs only
// the cheap relative-time format, not the per-event label lookup.
const rows = computed(() =>
	events.value.map((ev) => ({
		name: ev.event,
		timeMs: toMs(ev.time),
		detail: eventDetail(ev),
	})),
)

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
</script>

<style scoped>
.zw-node-events {
	display: flex;
	flex-direction: column;
}

.zw-node-events__row {
	display: flex;
	gap: 10px;
	padding: 8px 0;
	border-bottom: 1px dashed var(--zw-line);
}

.zw-node-events__row:last-of-type {
	border-bottom: none;
}

.zw-node-events__time {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
	width: 72px;
	flex-shrink: 0;
}

.zw-node-events__body {
	min-width: 0;
}

.zw-node-events__name {
	font-size: 12px;
	font-weight: 500;
}

.zw-node-events__detail {
	font-size: 11px;
	color: var(--zw-muted);
	margin-top: 2px;
	word-break: break-word;
}

.zw-node-events__footer {
	margin-top: 8px;
	padding-top: 8px;
	border-top: 1px dashed var(--zw-line);
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
	text-align: center;
}

.zw-node-events__empty {
	padding: 24px;
	color: var(--zw-muted);
	text-align: center;
	font-style: italic;
}
</style>
