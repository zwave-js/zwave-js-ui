<template>
	<div
		class="zw-row"
		:class="{
			'zw-row--expanded': expanded,
			'zw-row--mobile': viewport < MOBILE_BREAKPOINT,
		}"
		:style="rowStyle"
		@click="emit('open', device)"
	>
		<ZwStatusDot
			:status="device.isController ? 'controller' : device.status"
		/>
		<span class="zw-row__id">{{ nodeIdLabel }}</span>
		<span class="zw-row__name">
			<component
				:is="device.archetype.icon"
				:size="14"
				class="zw-row__archicon"
			/>
			<span class="zw-row__name-stack">
				<span class="zw-row__name-text">
					{{ device.name || device.product }}
				</span>
				<span v-if="subtitle" class="zw-row__sub">{{ subtitle }}</span>
			</span>
		</span>

		<!-- activity -->
		<span
			v-if="hasCol('activity') && viewport >= MOBILE_BREAKPOINT"
			class="zw-row__cell"
		>
			<ZwActivityReadout
				v-if="device.activity[0]"
				variant="table"
				:activity="device.activity[0]"
			/>
			<ZwChip v-else-if="device.hasUpdate" tone="warn">
				<DownloadIcon :size="ICON_SIZE.chip" /> UPDATE
			</ZwChip>
		</span>

		<!-- location -->
		<span
			v-if="hasCol('location') && viewport >= MOBILE_BREAKPOINT"
			class="zw-row__cell zw-row__cell--muted"
		>
			{{ device.location || '—' }}
		</span>

		<!-- value — hidden while expanded; the details body shows it instead -->
		<span
			v-if="hasCol('value') || viewport < MOBILE_BREAKPOINT"
			class="zw-row__cell"
		>
			<ZwCompactPrimary
				v-if="!expanded"
				:device="device"
				@action="(d, a) => emit('action', d, a)"
			/>
		</span>

		<!-- power -->
		<span
			v-if="hasCol('power') && viewport >= MOBILE_BREAKPOINT"
			class="zw-row__cell"
		>
			<span v-if="device.power.type === 'mains'" class="zw-row__mains">
				MAINS
			</span>
			<ZwBatteryMini v-else :pct="device.power.battery" />
		</span>

		<!-- signal -->
		<span
			v-if="hasCol('signal') && viewport >= MOBILE_BREAKPOINT"
			class="zw-row__cell"
		>
			<component
				:is="signal.icon"
				:size="14"
				:style="{ color: signal.color }"
			/>
		</span>

		<!-- last seen -->
		<span
			v-if="hasCol('lastSeen') && viewport >= MOBILE_BREAKPOINT"
			class="zw-row__cell zw-row__cell--last"
		>
			{{ device.lastSeen }}
		</span>

		<!-- chevron -->
		<span class="zw-row__cell">
			<button
				type="button"
				class="zw-row__expand"
				:aria-expanded="expanded"
				:aria-label="expanded ? 'Collapse details' : 'Expand details'"
				@click.stop="emit('open', device)"
			>
				<ChevronDownIcon
					:size="ICON_SIZE.caret"
					class="zw-row__chev"
					:class="{ 'zw-row__chev--open': expanded }"
				/>
			</button>
		</span>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwStatusDot from '@/components/dashboard/atoms/ZwStatusDot.vue'
import ZwBatteryMini from '@/components/dashboard/atoms/ZwBatteryMini.vue'
import ZwChip from '@/components/dashboard/atoms/ZwChip.vue'
import ZwActivityReadout from '@/components/dashboard/atoms/ZwActivityReadout.vue'
import ZwCompactPrimary from './ZwCompactPrimary.vue'
import { deviceRowGrid, type ToggleableCol } from './deviceRowGrid'
import { MOBILE_BREAKPOINT } from '@/lib/dashboard-breakpoints'
import { ChevronDownIcon, DownloadIcon, ICON_SIZE } from '@/lib/icons'
import { signalDisplay } from '@/lib/deviceSignal'
import { padNumber } from '@/lib/utils'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{
	device: Device
	expanded: boolean
	columns: ToggleableCol[]
	viewport: number
}>()

const emit = defineEmits<{
	// Request to show this device's details; the parent decides whether to
	// expand the row inline or open the drawer.
	open: [Device]
	action: [Device, DeviceAction]
}>()

const nodeIdLabel = computed(() => padNumber(props.device.nodeId, 3))

const subtitle = computed(() => {
	const parts = [props.device.manufacturer, props.device.productCode].filter(
		Boolean,
	)
	return parts.length ? parts.join(' · ') : ''
})

const rowStyle = computed(() => ({
	gridTemplateColumns: deviceRowGrid(props.viewport, props.columns),
}))

function hasCol(c: ToggleableCol): boolean {
	return props.columns.includes(c)
}

const signal = computed(() => signalDisplay(props.device.health))
</script>

<style scoped>
.zw-row {
	display: grid;
	column-gap: 8px;
	align-items: center;
	padding: 0 16px;
	height: 42px;
	border-bottom: 1px solid var(--zw-line);
	cursor: pointer;
	transition: background 0.12s;
}

.zw-row--mobile {
	padding: 8px 12px;
	height: auto;
}

.zw-row:hover {
	background: var(--zw-row-hover);
}

/* Opaque (not the translucent chip tint) because this row is rendered as
   a sticky overlay over scrolling detail content — it must not bleed. */
.zw-row--expanded {
	background: var(--zw-bg-soft);
}

.zw-row__id {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
}

.zw-row__name {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.zw-row__archicon {
	color: var(--zw-muted);
	flex: 0 0 auto;
}

.zw-row__name-stack {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.zw-row__name-text {
	font-size: 13px;
	font-weight: 600;
	color: var(--zw-fg);
	line-height: 1.25;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.zw-row__sub {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	line-height: 1.25;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.zw-row__cell {
	display: inline-flex;
	align-items: center;
	min-width: 0;
}

.zw-row__cell--muted {
	color: var(--zw-muted);
	font-size: 12px;
}

.zw-row__cell--last {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	justify-content: flex-end;
}

.zw-row__mains {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	letter-spacing: 0.4px;
}

.zw-row__expand {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	border: 0;
	background: none;
	color: inherit;
	cursor: pointer;
}

.zw-row__expand:focus-visible {
	outline: 2px solid var(--zw-fg);
	outline-offset: 2px;
	border-radius: 4px;
}

.zw-row__chev {
	color: var(--zw-fg-soft);
	transition: transform 0.18s;
}

.zw-row__chev--open {
	transform: rotate(180deg);
}
</style>
