<template>
	<div class="zw-prog">
		<svg
			class="zw-prog__ring"
			:width="SIZE"
			:height="SIZE"
			:viewBox="`0 0 ${SIZE} ${SIZE}`"
		>
			<circle
				class="zw-prog__arc zw-prog__arc--bg"
				:cx="cx"
				:cy="cx"
				:r="r"
				fill="none"
				:stroke-width="SW"
				stroke-linecap="round"
				:stroke-dasharray="ring.bgDash"
				:transform="rot"
			/>
			<circle
				v-if="current > 0"
				class="zw-prog__arc zw-prog__arc--done"
				:cx="cx"
				:cy="cx"
				:r="r"
				fill="none"
				:stroke-width="SW"
				stroke-linecap="round"
				:stroke-dasharray="ring.done.dasharray"
				:stroke-dashoffset="ring.done.dashoffset"
				:transform="rot"
			/>
			<circle
				v-if="current < steps.length"
				class="zw-prog__arc zw-prog__arc--active"
				:cx="cx"
				:cy="cx"
				:r="r"
				fill="none"
				:stroke-width="SW"
				stroke-linecap="round"
				:stroke-dasharray="ring.active.dasharray"
				:stroke-dashoffset="ring.active.dashoffset"
				:transform="rot"
			/>
		</svg>
		<div class="zw-prog__titles">
			<div v-if="title" class="zw-prog__wizard">{{ title }}</div>
			<div class="zw-prog__step">{{ steps[current] }}</div>
			<div v-if="subtitle" class="zw-prog__sub">{{ subtitle }}</div>
		</div>
		<ZwCloseButton v-if="showClose" flush @click="emit('close')" />
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwCloseButton from '@/components/dashboard/atoms/ZwCloseButton.vue'
import { stepRing } from '@/lib/dialogStepRing.ts'

const props = withDefaults(
	defineProps<{
		steps: string[]
		current: number
		title?: string
		subtitle?: string
		showClose?: boolean
	}>(),
	{ title: '', subtitle: '', showClose: true },
)

const emit = defineEmits<{ close: [] }>()

const SIZE = 46
const SW = 5
const r = (SIZE - SW) / 2
const cx = SIZE / 2
const C = 2 * Math.PI * r

const ring = computed(() => stepRing(props.steps.length, props.current, C))
const rot = computed(() => `rotate(${ring.value.rotationDeg} ${cx} ${cx})`)
</script>

<style scoped>
.zw-prog {
	display: flex;
	align-items: center;
	gap: 14px;
	padding: var(--zw-dlg-pad-top) var(--zw-dlg-pad-x) 14px;
	flex-shrink: 0;
}

.zw-prog__ring {
	flex-shrink: 0;
	display: block;
}

.zw-prog__arc {
	transition:
		stroke-dasharray 0.3s,
		stroke-dashoffset 0.3s;
}

.zw-prog__arc--bg {
	stroke: var(--zw-line);
}

.zw-prog__arc--done {
	stroke: var(--zw-ok);
}

.zw-prog__arc--active {
	stroke: var(--zw-accent);
}

.zw-prog__titles {
	min-width: 0;
	flex: 1;
}

.zw-prog__wizard {
	font: var(--zw-text-caption);
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.zw-prog__step {
	font: var(--zw-text-h-m);
	line-height: 1.25;
	color: var(--zw-fg);
}

.zw-prog__sub {
	margin-top: 2px;
	font: var(--zw-text-caption);
	color: var(--zw-muted);
	line-height: 1.4;
}
</style>
