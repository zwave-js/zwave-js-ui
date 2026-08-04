<template>
	<span class="zw-tx" :class="`zw-tx--${variant}`" :title="title">
		<component :is="iconComp" :size="ICON_SIZE.chip" class="zw-tx__icon" />
		<ZwProgressBar
			as="span"
			shimmer
			class="zw-tx__bar"
			:value="pct ?? null"
		/>
		<span v-if="pct !== undefined" class="zw-tx__pct">{{ pct }}%</span>
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ZwProgressBar from '@/components/dashboard/atoms/ZwProgressBar.vue'
import {
	DownloadIcon,
	RefreshIcon,
	InterviewIcon,
	ICON_SIZE,
} from '@/lib/icons'

type ActivityType = 'ota' | 'rebuild' | 'interview'
interface Activity {
	type: ActivityType
	label: string
	progress?: number
}

const props = withDefaults(
	defineProps<{
		activity: Activity
		variant?: 'table' | 'card'
	}>(),
	{ variant: 'table' },
)

const ACTIVITY_ICON = {
	ota: DownloadIcon,
	rebuild: RefreshIcon,
	interview: InterviewIcon,
} as const

const iconComp = computed(() => ACTIVITY_ICON[props.activity.type])

const pct = computed(() =>
	props.activity.progress !== undefined
		? Math.round(props.activity.progress)
		: undefined,
)

const title = computed(() =>
	pct.value !== undefined
		? `${props.activity.label} · ${pct.value}%`
		: props.activity.label,
)
</script>

<style>
.zw-tx {
	display: inline-flex;
	align-items: center;
	font-family: var(--zw-font);
	color: var(--zw-accent-dark);
}

.zw-tx--table {
	gap: 6px;
}

.zw-tx--card {
	gap: 8px;
	flex: 1;
	min-width: 0;
}

.zw-tx__icon {
	flex: 0 0 auto;
	color: var(--zw-accent);
}

.zw-tx__bar {
	--zw-progress-h: 4px;
	--zw-progress-radius: var(--zw-radius-xs);
	--zw-progress-track: rgba(var(--v0-primary), 0.18);
}

.zw-tx--table .zw-tx__bar {
	width: 36px;
	flex: 0 0 36px;
}

.zw-tx--card .zw-tx__bar {
	flex: 1;
	min-width: 24px;
}

.zw-tx__pct {
	font: var(--zw-text-mono-micro);
	min-width: 26px;
	text-align: right;
	font-variant-numeric: tabular-nums;
}
</style>
