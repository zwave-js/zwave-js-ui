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
				:stroke-dasharray="bgDash"
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
				:stroke-dasharray="doneRing.dasharray"
				:stroke-dashoffset="doneRing.dashoffset"
				:transform="rot"
			/>
			<circle
				v-if="current < total"
				class="zw-prog__arc zw-prog__arc--active"
				:cx="cx"
				:cy="cx"
				:r="r"
				fill="none"
				:stroke-width="SW"
				stroke-linecap="round"
				:stroke-dasharray="activeRing.dasharray"
				:stroke-dashoffset="activeRing.dashoffset"
				:transform="rot"
			/>
		</svg>
		<div class="zw-prog__titles">
			<div class="zw-prog__step">{{ steps[current] }}</div>
			<div v-if="subtitle" class="zw-prog__sub">{{ subtitle }}</div>
		</div>
		<ZwDialogClose v-if="closable" @click="emit('close')" />
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwDialogClose from './ZwDialogClose.vue'

const props = withDefaults(
	defineProps<{
		steps: string[]
		current: number
		subtitle?: string
		closable?: boolean
	}>(),
	{ subtitle: '', closable: true },
)

const emit = defineEmits<{ close: [] }>()

// Gap angle (22°) must exceed what `round` linecaps consume at each end
const SIZE = 46
const SW = 5
const r = (SIZE - SW) / 2
const cx = SIZE / 2
const C = 2 * Math.PI * r

const total = computed(() => props.steps.length)
const gap = computed(() => (total.value > 1 ? 22 : 0))
const segArc = computed(() => ((360 / total.value - gap.value) / 360) * C)
const gapArc = computed(() => (gap.value / 360) * C)
const rot = computed(() => `rotate(${gap.value / 2 - 90} ${cx} ${cx})`)

const bgDash = computed(() =>
	total.value > 1 ? `${segArc.value} ${gapArc.value}` : `${C}`,
)

// Last gap absorbs leftover circumference so the pattern sums to exactly C
function ringDash(start: number, count: number) {
	const arr: number[] = []
	for (let i = 0; i < count; i++) arr.push(segArc.value, gapArc.value)
	arr[arr.length - 1] += C - count * (segArc.value + gapArc.value)
	return {
		dasharray: arr.join(' '),
		dashoffset: -(start * (segArc.value + gapArc.value)),
	}
}

const doneRing = computed(() => ringDash(0, props.current))
const activeRing = computed(() => ringDash(props.current, 1))
</script>

<style scoped>
.zw-prog {
	display: flex;
	align-items: center;
	gap: 14px;
	padding: 18px 20px 14px;
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
