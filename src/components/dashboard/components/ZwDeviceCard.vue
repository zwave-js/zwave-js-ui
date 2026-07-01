<template>
	<div
		class="zw-card"
		:class="{ 'zw-card--dead': device.status === 'dead' }"
		role="button"
		tabindex="0"
		@click="emit('open', device)"
		@keydown="onKeyDown"
	>
		<header class="zw-card__header">
			<div
				class="zw-card__icon"
				:class="{ 'zw-card__icon--alert': isAlertState }"
			>
				<component :is="device.archetype.icon" :size="18" />
			</div>
			<div class="zw-card__name-col">
				<div class="zw-card__name">{{ device.name }}</div>
				<div class="zw-card__sub">
					{{ nodeIdLabel }} ·
					{{ device.location || 'No location' }}
				</div>
			</div>
		</header>

		<div class="zw-card__body">
			<ZwPrimaryDisplay
				v-if="!device.isController"
				:device="device"
				@action="(d, a) => emit('action', d, a)"
			/>
		</div>

		<footer class="zw-card__foot">
			<ZwActivityReadout
				v-if="device.activity[0]"
				variant="card"
				:activity="device.activity[0]"
			/>
			<template v-else>
				<ZwSignalBars
					v-if="!device.isController"
					:level="signal.level"
					:label="signal.label"
				/>
				<ZwPill
					v-if="device.status === 'asleep'"
					tone="asleep"
					size="sm"
				>
					<MoonIcon :size="ICON_SIZE.pill" /> Asleep
				</ZwPill>
				<ZwPill
					v-else-if="device.status === 'dead'"
					tone="danger"
					size="sm"
				>
					Dead
				</ZwPill>
				<ZwPill
					v-else-if="device.interviewState === 'interview'"
					tone="info"
					size="sm"
				>
					Interviewing
				</ZwPill>
				<ZwPill v-else-if="device.hasUpdate" tone="accent" size="sm">
					<DownloadIcon :size="ICON_SIZE.pill" /> Update
				</ZwPill>
				<ZwBatteryMini
					v-if="device.power.type === 'battery'"
					class="zw-card__battery"
					:pct="device.power.battery"
				/>
			</template>
		</footer>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwPrimaryDisplay from './ZwPrimaryDisplay.vue'
import ZwPill from '@/components/dashboard/atoms/ZwPill.vue'
import ZwBatteryMini from '@/components/dashboard/atoms/ZwBatteryMini.vue'
import ZwSignalBars from '@/components/dashboard/atoms/ZwSignalBars.vue'
import ZwActivityReadout from '@/components/dashboard/atoms/ZwActivityReadout.vue'
import { DownloadIcon, ICON_SIZE, MoonIcon } from '@/lib/icons'
import { signalDisplay } from '@/lib/deviceSignal'
import { isStateAlert } from '@/lib/primaryValue'
import { padNumber } from '@/lib/utils'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{
	open: [Device]
	action: [Device, DeviceAction]
}>()

const nodeIdLabel = computed(() => padNumber(props.device.nodeId, 3))
const signal = computed(() => signalDisplay(props.device.health))

const isAlertState = computed(() => {
	const pv = props.device.primaryValue
	return pv?.type === 'state' ? isStateAlert(pv) : false
})

function onKeyDown(e: KeyboardEvent) {
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault()
		emit('open', props.device)
	}
}
</script>

<style scoped>
.zw-card {
	display: flex;
	flex-direction: column;
	gap: 12px;
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 4px;
	box-shadow: var(--zw-e2);
	padding: 12px;
	min-height: 132px;
	cursor: pointer;
	transition:
		box-shadow 0.2s,
		border-color 0.15s;
	position: relative;
}

.zw-card:hover {
	box-shadow: var(--zw-e4);
}

.zw-card:focus-visible {
	outline: 2px solid var(--zw-accent);
	outline-offset: 1px;
}

.zw-card--dead {
	opacity: 0.66;
}

.zw-card__header {
	display: flex;
	align-items: center;
	gap: 10px;
}

.zw-card__icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: 10px;
	background: var(--zw-chip-bg);
	color: var(--zw-fg);
	flex: 0 0 36px;
}

.zw-card__icon--alert {
	background: var(--zw-warn-soft);
	color: var(--zw-warning);
}

.zw-card__name-col {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.zw-card__name {
	font-size: 14px;
	font-weight: 600;
	color: var(--zw-fg);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.zw-card__sub {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
}

.zw-card__body {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
}

.zw-card__foot {
	display: flex;
	align-items: center;
	gap: 8px;
	min-height: 18px;
}

.zw-card__battery {
	margin-left: auto;
}
</style>
